/*
	WFM - Workflow Manager

	Copyright (c) 2015 - 2019 Cédric Ronvel

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



const minimist = require( 'minimist' ) ;
const string = require( 'string-kit' ) ;
const path = require( 'path' ) ;
const glob = require( 'glob' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;

const notifications = require( 'freedesktop-notifications' ) ;
notifications.setAppName( 'wfm' ) ;

const aliases = require( './aliases.json' ) ;
const wfmPackage = require( '../package.json' ) ;

require( './patches.js' ) ;



const wfm = {} ;
module.exports = wfm ;



wfm.cli = async function() {
	var args , command , commandFile ;

	term.bold.magenta( 'Workflow Manager' ).dim( ' v%s by Cédric Ronvel\n\n' , wfmPackage.version ) ;

	args = minimist( process.argv.slice( 2 ) ) ;

	command = args._.shift() ;

	if ( ! command ) {
		wfm.usage() ;
		process.exit() ;
	}

	if ( aliases[ command ] ) { command = aliases[ command ] ; }

	commandFile = __dirname + '/' + command + '.com.js' ;

	await wfm.init() ;

	try {
		require( commandFile )( args ) ;
	}
	catch ( error ) {
		if ( error.code === 'MODULE_NOT_FOUND' ) { wfm.exitError( "Unknown command: %s\n" , command ) ; }
		else { wfm.exitError( "Error in the command module: %E\n" , error ) ; }
	}
} ;



wfm.init = function( callback ) {
	term.grabInput() ;

	term.on( 'key' , ( key ) => {
		if ( key === 'CTRL_C' ) {
			term.green( '\nCTRL-C received...\n' ) ;
			//terminate() ;
			process.exit() ;
		}
	} ) ;

	var promise = new Promise() ;
	notifications.init( promise.createCallback() ) ;
	return promise ;
} ;



wfm.usage = function() {
	term( "^+Usage is:^:\n^bwfm <command> [<option1>], [<option2>] , [...]\n\n" ) ;

	var commands = glob.sync( __dirname + '/*.com.js' ).map( file => path.basename( file ).replace( /\.com\.js$/ , '' ) ) ;

	term( "^+Available commands:^:\n^m%s^:\n\n" , commands.join( ' ' ) ) ;
} ;



wfm.exitError = function( ... args ) {
	var message = string.format( ... args ) ;

	term.bold.red( message ) ;

	notifications.createNotification( {
		summary: 'wfm: error' ,
		body: message ,
		icon: 'dialog-warning'
	} ).push() ;

	process.exit( 1 ) ;
} ;



wfm.packagify = function( object ) {
	return JSON.stringify( object , null , '  ' ) ;
} ;

