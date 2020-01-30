/*
	WFM - Workflow Manager

	Copyright (c) 2015 - 2020 Cédric Ronvel

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



require( './patches.js' ) ;
const fs = require( 'fs' ) ;
//const fsKit = require( 'fs-kit' ) ;
//const path = require( 'path' ) ;
//const exec = require( 'child_process' ).exec ;
//const execSync = require( 'child_process' ).execSync ;

//const semver = require( 'semver' ) ;
const string = require( 'string-kit' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

const Promise = require( 'seventh' ) ;

const wfm = require( './wfm.js' ) ;
//const git = require( './git.js' ) ;
//const make = require( './make.js' ) ;



async function setupEnvironment( args ) {
	var state = {} ;

	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;

	// Preliminary check

	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}

	await eslintrc( state ) ;
	await gitignore( state ) ;

	term.bold.green( "\n\nSetup finished for Project " )
		.bold.italic.cyan( state.package.name )
		.brightYellow( ' v' + state.package.version )
		.bold.green( "!\n\n" ) ;

	notifications.createNotification( {
		summary: 'wfm: success' ,
		body: string.format( "Setup finished for Project <b>%s</b> <i>v%s</i>!" , state.package.name , state.package.version ) ,
		icon: 'face-cool'
	} ).push() ;

	process.exit( 0 ) ;
}

module.exports = setupEnvironment ;



async function eslintrc( state ) {
	term.bold.magenta( 'ESLint config: ' ) ;

	try {
		await fs.copyFileAsync( __dirname + '/../data/eslintrc.js' , state.cwd + '/.eslintrc.js' ) ;
	}
	catch ( error ) {
		term.red( 'KO!' )( '\n' ) ;
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	term.brightGreen( 'OK' )( '\n' ) ;
}



function gitignore( state ) {
	term.bold.magenta( 'Git ignore-list merge: ' ) ;
	term.yellow( 'TODO' )( '\n' ) ;
}



function usage() {
	term( "Usage is: wfm [setup-]env[ironment]\n\n" ) ;
	term( '\n' ) ;
}

