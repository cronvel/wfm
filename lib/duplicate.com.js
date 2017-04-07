/*
	WFM - Workflow Manager
	
	Copyright (c) 2015 - 2017 Cédric Ronvel
	
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
var fsKit = require( 'fs-kit' ) ;
var path = require( 'path' ) ;
var exec = require( 'child_process' ).exec ;
var execSync = require( 'child_process' ).execSync ;

var semver = require( 'semver' ) ;
var string = require( 'string-kit' ) ;
var async = require( 'async-kit' ) ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;
var notifications = require( 'freedesktop-notifications' ) ;

var ini = require( 'ini' ) ;
var tmp = require( 'tmp' ) ;

var wfm = require( './wfm.js' ) ;



/*
	wfm duplicate url [--clone <local/path/to/clone>]
	
	Duplicate (i.e. mirror) a repository to a new url.
	If the clone option is given, the new mirror is cloned to that path.
*/



function duplicate( args )
{
	var state = {} ;
	
	state.destinationUrl = args._[ 0 ] ;
	state.clonePath = args.clone || null ;
	state.cwd = process.cwd() ;
	
	// Preliminary check
	try {
		state.gitConfig = ini.parse( fs.readFileSync( '.git/config' , 'utf-8' ) ) ;
		state.sourceUrl = state.gitConfig['remote "origin"'].url ;
	}
	catch ( error ) {
		wfm.exitError( "No .git found in the current working directory.\n" ) ;
	}
	
	state.repositoryName = state.sourceUrl.replace( /^.*([:\/])([^\/:]+?)(\.git)?$/ , '$2' ) ;
	
	
	
	// Run the main process!
	
	
	async.series( [
		askForDestinationUrl ,
		duplicateRepository ,
		clone
	] )
	.using( [ state ] )
	.exec( function() {
		
		if ( state.tmpDirCleanupCallback ) { state.tmpDirCleanupCallback() ; }
		
		term.bold.green( "\n\nRepository " )
			.bold.italic.cyan( state.repositoryName )
			.bold.green( " was successfully duplicated!\n\n" ) ;
		
		notifications.createNotification( {
			summary: 'wfm: success' ,
			body: string.format( "Project <b>%s</b> was successfully duplicated!" , state.repositoryName ) ,
			icon: 'face-cool'
		} ).push() ;
		
		process.exit( 0 ) ;
	} ) ;
}

module.exports = duplicate ;



function askForDestinationUrl( state , callback )
{
	if ( state.destinationUrl ) { callback() ; return ; }
	
	term.bold.brightYellow( 'Please enter the destination URL: ' ) ;
	
	var notif = notifications.createNotification( {
		summary: 'wfm: destination URL needed!' ,
		body: 'A destination URL is needed!' ,
		icon: 'input-keyboard'
	} ) ;
	
	notif.push() ;
	
	term.inputField( function( error , input ) {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		state.destinationUrl = input ;
		callback() ;
	} ) ;
}



function duplicateRepository( state , callback )
{
	term.bold.magenta( 'Duplicating the Git repository...\n' ) ;
	term.magenta( '* Create tmp directory: ' ) ;
	
	tmp.dir( { unsafeCleanup: true } , function( error , tmpDirPath , tmpDirCleanupCallback ) {
		
		if ( error ) { callback( error ) ; return ; }
		
		state.tmpDirCleanupCallback = tmpDirCleanupCallback ;
		term.magenta( "%s\n" , tmpDirPath ) ;
		term.magenta( '* git clone bare repository\n' ) ;
		
		exec( 'git clone --bare ' + string.escape.shellArg( state.sourceUrl ) + ' ' + tmpDirPath , function( error , stdout , stderr ) {
			
			if ( error ) { wfm.exitError( "git clone bare repository error %s:\n%s\n" , error , stderr ) ; }
			
			term.magenta( '* git push mirror\n' ) ;
			
			exec( 'cd ' + tmpDirPath + ' ; git push --mirror ' + string.escape.shellArg( state.destinationUrl ) , function( error , stdout , stderr ) {
			
				if ( error ) { wfm.exitError( "git push mirror error %s:\n%s\n" , error , stderr ) ; }
				
				callback() ;
			} ) ;
		} ) ;
	} ) ;
}



function clone( state , callback )
{
	if ( ! state.clonePath ) { callback() ; return ; }
	
	term.bold.magenta( 'Cloning the new Git repository...\n' ) ;
	
	exec( 'git clone ' + string.escape.shellArg( state.destinationUrl ) + ' ' + string.escape.shellArg( state.clonePath ) , function( error , stdout , stderr ) {
		
		if ( error ) { wfm.exitError( "git clone bare repository error %s:\n%s\n" , error , stderr ) ; }
		callback() ;
	} ) ;
}



function usage()
{
	term( "Usage is: wfm duplicate url [--clone <local/path/to/clone>]\n\n" ) ;
	term( '\n' ) ;
}

