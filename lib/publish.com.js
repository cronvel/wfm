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
	var status = {} ;
	
	status.releaseType = args._[ 0 ] ;
	status.cwd = process.cwd() ;
	status.packagePath = status.cwd + '/package.json' ;
	
	// Preliminary check
	
	try {
		status.package = require( status.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}
	
	if ( status.package.private )
	{
		wfm.exitError( "I will not publish this private repository!\n" ) ;
	}
	
	if ( ! fs.existsSync( status.cwd + '/.git' ) )
	{
		wfm.exitError( "The package should be at the root of a git repository.\n" ) ;
	}
	
	async.series( [
		checkWdAndSetCommitMessage ,
		packageVersion ,
		writePackage ,
		gitCommit ,
		gitTag ,
		gitPush ,
		npmPublish
	] )
	.using( [ status ] )
	.exec( function() {
		term.bold.green( "Project " )
			.bold.italic.cyan( status.package.name )
			.brightYellow( ' v' + status.package.version )
			.bold.green( " was successfully published!\n" ) ;
		
		notifications.createNotification( {
			summary: 'wfm: success' ,
			body: string.format( "Project %s v%s was successfully published!" , status.package.name , status.package.version ) ,
			icon: 'face-cool'
		} ).push() ;
		
		process.exit( 0 ) ;
	} ) ;
}

module.exports = publish ;



function checkWdAndSetCommitMessage( status , callback )
{
	if ( git.isWdClean() ) { callback() ; return ; }
	term.bold.brightYellow( 'Your working directory contains changes to be commited, please enter a commit message:\n' ) ;
	
	term.inputField( function( error , input ) {
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		status.commitMessage = input ;
		callback() ;
	} ) ;
}



function packageVersion( status , callback )
{
	switch ( status.releaseType )
	{
		case 'patch' :
		case 'minor' :
		case 'major' :
			status.package.version = semver.inc( status.package.version , status.releaseType ) ;
			status.writePackage = true ;
			term( "New version: %s\n" , status.package.version ) ;
			break ;
		case 'again' :
			term( "Version: %s\n" , status.package.version ) ;
			break ;
		default :
			usage() ;
			process.exit() ;
	}
	
	callback() ;
}


	
function writePackage( status , callback )
{
	if ( ! status.writePackage ) { callback() ; return ; }
	
	fs.writeFileSync( status.packagePath , wfm.packagify( status.package ) ) ;
	
	callback() ;
}


	
function gitCommit( status , callback )
{
	var commitMessage = status.commitMessage || 'publishing ' + status.releaseType + ' version' ;
	
	try {
		execSync( 'git commit -am ' + string.escape.shellArg( commitMessage ) ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}


	
function gitTag( status , callback )
{
	try {
		execSync( 'git tag v' + status.package.version ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}



function gitPush( status , callback )
{
	try {
		execSync( 'git push' ) ;
		execSync( 'git push --tags' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}	



function npmPublish( status , callback )
{
	try {
		execSync( 'npm publish' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	callback() ;
}



function usage()
{
	term( "Usage is: wfm publish patch|minor|major|again\n" ) ;
}

