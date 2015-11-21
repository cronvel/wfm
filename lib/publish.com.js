/*
	The Cedric's Swiss Knife (CSK) - CSK wfm

	Copyright (c) 2015 Cédric Ronvel 
	
	The MIT License (MIT)

	Permission is hereby granted, free of charge, to any person obtaining a copy
	of this software and associated documentation files (the "Software"), to deal
	in the Software without restriction, including without limitation the rights
	to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
	copies of the Software, and to permit persons to whom the Software is
	furnished to do so, subject to the following conditions:

	The above copyright notice and this permission notice shall be included in all
	copies or substantial portions of the Software.

	THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
	IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
	FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
	AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
	LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
	OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
	SOFTWARE.
*/



// Load modules
var fs = require( 'fs' ) ;
var exec = require( 'child_process' ).exec ;
var execSync = require( 'child_process' ).execSync ;

var semver = require( 'semver' ) ;
var string = require( 'string-kit' ) ;
var async = require( 'async-kit' ) ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;
var notifications = require( 'freedesktop-notifications' ) ;

var wfm = require( './wfm.js' ) ;
var git = require( './git.js' ) ;



function publish( args )
{
	var state = {} ;
	
	state.releaseType = args._[ 0 ] ;
	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;
	
	// Preliminary check
	
	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}
	
	if ( state.package.private )
	{
		wfm.exitError( "I will not publish this private repository!\n" ) ;
	}
	
	if ( ! fs.existsSync( state.cwd + '/.git' ) )
	{
		wfm.exitError( "The package should be at the root of a git repository.\n" ) ;
	}
	
	if ( [ 'patch' , 'minor' , 'major' , 'again' ].indexOf( state.releaseType ) === -1 )
	{
		usage() ;
		process.exit() ;
	}
	
	// Run the main process!
	
	
	async.series( [
		checkGitStatus ,
		checkChangelog ,
		
		askForGitAdd ,
		askForMessage ,
		
		packageVersion ,
		
		gitAddUntrackedFiles ,
		writeChangelog ,
		writePackage ,
		
		gitCommit ,
		gitTag ,
		
		gitPush ,
		npmPublish
		//parallelPublish
	] )
	.using( [ state ] )
	.exec( function() {
		term.bold.green( "\n\nProject " )
			.bold.italic.cyan( state.package.name )
			.brightYellow( ' v' + state.package.version )
			.bold.green( " was successfully published!\n\n" ) ;
		
		notifications.createNotification( {
			summary: 'wfm: success' ,
			body: string.format( "Project <b>%s</b> <i>v%s</i> was successfully published!" , state.package.name , state.package.version ) ,
			icon: 'face-cool'
		} ).push() ;
		
		process.exit( 0 ) ;
	} ) ;
}

module.exports = publish ;



function checkGitStatus( state , callback )
{
	git.gitStatus( state ) ;
	callback() ;
}



function checkChangelog( state , callback )
{
	state.hasChangelog = fs.existsSync( state.cwd + '/CHANGELOG' ) ;
	callback() ;
}



function askForGitAdd( state , callback )
{
	var k , notif , controler , answered = false ;
	
	if ( ! state.gitUntrackedFiles ) { callback() ; return ; }
	
	term.bold.magenta( '\nThere are untracked files:\n' ) ;
	
	for ( k in state.gitUntrackedFiles )
	{
		term.blue( '  %s\n' , state.gitUntrackedFiles[ k ] ) ;
	}
	
	term.italic.bold.brightYellow( '\ngit add' ).bold.brightYellow( ' all those files? [y/n] ' ) ;
	
	notif = notifications.createNotification( {
		summary: 'wfm: git add files?' ,
		body: 'There are untracked files: \n' + state.gitUntrackedFiles.join( ', ' ) + '\n<b><i>git add</i> all those files?</b>' ,
		icon: 'dialog-question' ,
		actions: {
			yes: 'Yes' ,
			no: 'No'
		}
	} ) ;
	
	notif.on( 'action' , function( answer ) {
		if ( answered ) { return ; }
		controler.abort() ;
		term( '%s\n' , answer ) ;
		if ( answer === 'no' ) { wfm.exitError( "I will not publish an unclean Working Directory!\n" ) ; }
		callback() ;
	} ) ;
	
	notif.push() ;
	
	controler = term.yesOrNo( function( error , answer ) {
		if ( answered ) { return ; }
		notif.close() ;
		term( '\n' ) ;
		if ( error || ! answer ) { wfm.exitError( "I will not publish an unclean Working Directory!\n" ) ; }
		callback() ;
	} ) ;
}



function askForMessage( state , callback )
{
	if ( state.message ) { callback() ; return ; }
	
	if ( ! state.gitCleanWd )
	{
		term.bold.brightYellow( 'Your working directory contains changes to be commited, please enter a message:\n' ) ;
	}
	else if ( state.hasChangelog )
	{
		term.bold.brightYellow( 'You have a CHANGELOG file, please enter a message:\n' ) ;
	}
	else
	{
		callback() ;
		return ;
	}
	
	var notif = notifications.createNotification( {
		summary: 'wfm: message needed!' ,
		body: 'A message is needed!' ,
		icon: 'input-keyboard'
	} ) ;
	
	notif.push() ;
	
	term.inputField( function( error , input ) {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		state.message = input ;
		callback() ;
	} ) ;
}



function packageVersion( state , callback )
{
	switch ( state.releaseType )
	{
		case 'patch' :
		case 'minor' :
		case 'major' :
			state.package.version = semver.inc( state.package.version , state.releaseType ) ;
			state.writePackage = true ;
			term.bold.magenta( "new version: " ).brightYellow( state.package.version )( '\n' ) ;
			break ;
		case 'again' :
			term.bold.magenta( "version: " ).brightYellow( state.package.version )( '\n' ) ;
			break ;
	}
	
	callback() ;
}


	
function writePackage( state , callback )
{
	if ( ! state.writePackage ) { callback() ; return ; }
	
	term.bold.magenta( 'writing package.json\n' ) ;
	
	fs.writeFileSync( state.packagePath , wfm.packagify( state.package ) ) ;
	
	callback() ;
}


	
function writeChangelog( state , callback )
{
	if ( ! state.hasChangelog ) { callback() ; return ; }
	
	var header , content ;
	
	term.bold.magenta( 'writing CHANGELOG\n' ) ;
	
	content = fs.readFileSync( state.cwd + '/CHANGELOG' ).toString() ;
	
	header = 'v' + state.package.version ;
	header += '\n' + '-'.repeat( header.length ) + '\n\n' ;
	
	content = '\n' + header + state.message + '\n\n' + content ;
	
	fs.writeFileSync( state.cwd + '/CHANGELOG' , content ) ;
	
	callback() ;
}



function gitAddUntrackedFiles( state , callback )
{
	var commandArgs ;
	
	if ( ! state.gitUntrackedFiles ) { callback() ; return ; }
	
	term.bold.magenta( 'git add untracked files\n' ) ;
	
	commandArgs = state.gitUntrackedFiles.map( string.escape.shellArg ).join( ' ' ) ;
	
	try {
		execSync( 'git add ' + commandArgs ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}



function gitCommit( state , callback )
{
	var commitMessage = state.message || 'publishing ' + state.releaseType + ' version' ;
	
	term.bold.magenta( 'git commit\n' ) ;
	
	try {
		execSync( 'git commit -am ' + string.escape.shellArg( commitMessage ) ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}



function gitTag( state , callback )
{
	term.bold.magenta( 'git tag\n' ) ;
	
	try {
		execSync( 'git tag v' + state.package.version +
			' -a -m v' + state.package.version +
			' -m ' + string.escape.shellArg( state.message )
		) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}



function gitPush( state , callback )
{
	term.bold.magenta( 'git push\n' ) ;
	
	exec( 'git push --follow-tags' , function( error , stdout , stderr ) {
		
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		callback() ;
	} ) ;
}	



function npmPublish( state , callback )
{
	term.bold.magenta( 'npm publish\n' ) ;
	
	exec( 'npm publish' , function( error , stdout , stderr ) {
		
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		callback() ;
	} ) ;
}



function usage()
{
	term( "Usage is: wfm publish patch|minor|major|again\n" ) ;
}

