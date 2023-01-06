/*
	WFM - Workflow Manager

	Copyright (c) 2015 - 2023 Cédric Ronvel

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

"use strict" ;



const fs = require( 'fs' ) ;
const fsKit = require( 'fs-kit' ) ;
//const path = require( 'path' ) ;

require( './patches.js' ) ;
const childProcess = require( 'child_process' ) ;
const execAsync = childProcess.execAsync ;
const execAsyncAll = childProcess.execAsyncAll ;

const Promise = require( 'seventh' ) ;

const string = require( 'string-kit' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

const ini = require( 'ini' ) ;

const wfm = require( './wfm.js' ) ;



/*
	wfm duplicate url [--clone <local/path/to/clone>]

	Duplicate (i.e. mirror) a repository to a new url.
	If the clone option is given, the new mirror is cloned to that path.
*/



async function duplicate( args ) {
	var state = {} ;

	state.destinationUrl = args.commandArgs[ 0 ] ;
	state.clonePath = args.clone || null ;
	state.cwd = process.cwd() ;

	// Preliminary check
	try {
		state.gitConfig = ini.parse( await fs.promises.readFile( '.git/config' , 'utf-8' ) ) ;
		state.sourceUrl = state.gitConfig['remote "origin"'].url ;
	}
	catch ( error ) {
		wfm.exitError( "No .git found in the current working directory.\n" ) ;
	}

	state.repositoryName = state.sourceUrl.replace( /^.*([:/])([^/:]+?)(\.git)?$/ , '$2' ) ;

	await askForDestinationUrl( state ) ;
	await duplicateRepository( state ) ;
	await clone( state ) ;

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
}

module.exports = duplicate ;



function askForDestinationUrl( state ) {
	if ( state.destinationUrl ) { return Promise.resolved ; }

	term.bold.brightYellow( 'Please enter the destination URL: ' ) ;

	var notif = notifications.createNotification( {
		summary: 'wfm: destination URL needed!' ,
		body: 'A destination URL is needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
			state.destinationUrl = input ;
			resolve() ;
		} ) ;
	} ) ;
}



async function duplicateRepository( state ) {
	var tmpDirPath , tmpDirCleanupCallback , stdout , stderr ;

	term.bold.magenta( 'Duplicating the Git repository...\n' ) ;
	term.magenta( '* Create tmp directory: ' ) ;

	//[ tmpDirPath , tmpDirCleanupCallback ] = await tmp.dirAsyncAll( { unsafeCleanup: true } ) ;
	( { path: tmpDirPath , cleanup: tmpDirCleanupCallback } = await fsKit.tmpDir( { unsafeCleanup: true } ) ) ;

	state.tmpDirCleanupCallback = tmpDirCleanupCallback ;
	term.magenta( "%s\n" , tmpDirPath ) ;
	term.magenta( '* git clone bare repository\n' ) ;

	try {
		[ stdout , stderr ] = await execAsyncAll( 'git clone --bare ' + string.escape.shellArg( state.sourceUrl ) + ' ' + tmpDirPath ) ;
	}
	catch ( error ) {
		wfm.exitError( "git clone bare repository error %s:\n%s\n" , error , stderr ) ;
	}

	term.magenta( '* git push mirror\n' ) ;

	try {
		[ stdout , stderr ] = await execAsyncAll( 'cd ' + tmpDirPath + ' ; git push --mirror ' + string.escape.shellArg( state.destinationUrl ) ) ;
	}
	catch ( error ) {
		wfm.exitError( "git push mirror error %s:\n%s\n" , error , stderr ) ;
	}
}



async function clone( state ) {
	var stdout , stderr ;

	if ( ! state.clonePath ) { return ; }

	term.bold.magenta( 'Cloning the new Git repository...\n' ) ;

	try {
		[ stdout , stderr ] = await execAsyncAll( 'git clone ' + string.escape.shellArg( state.destinationUrl ) + ' ' + string.escape.shellArg( state.clonePath ) ) ;
	}
	catch ( error ) {
		wfm.exitError( "git clone bare repository error %s:\n%s\n" , error , stderr ) ;
	}
}



function usage() {
	term( "Usage is: wfm duplicate url [--clone <local/path/to/clone>]\n\n" ) ;
	term( '\n' ) ;
}

