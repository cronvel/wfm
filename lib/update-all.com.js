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



const fs = require( 'fs' ) ;
const fsKit = require( 'fs-kit' ) ;
const path = require( 'path' ) ;

require( './patches.js' ) ;
const childProcess = require( 'child_process' ) ;
//const spawn = childProcess.spawn ;
//const exec = childProcess.exec ;
const execAsync = childProcess.execAsync ;
//const execAsyncAll = childProcess.execAsyncAll ;

const Promise = require( 'seventh' ) ;

//const string = require( 'string-kit' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

//const wfm = require( './wfm.js' ) ;
const git = require( './git.js' ) ;



async function update( args ) {
	var directory ,
		state = {} ;

	if ( args.help || args.h ) {
		usage() ;
		process.exit() ;
	}

	// Process arguments
	state.cwd = process.cwd() ;

	// Preliminary check
	state.directories = await fsKit.readdir( './' , { files: false } ) ;


	for ( directory of state.directories ) {
		term( '^CEntering^ %s ...\n' , directory ) ;
		state.currentDirectory = path.join( state.cwd , directory ) ;

		try {
			process.chdir( state.currentDirectory ) ;
			await fs.promises.access( path.join( state.currentDirectory , '.git' ) ) ;
			await checkGitStatus( state ) ;
			await gitPull( state ) ;
			await npmInstall( state ) ;
		}
		catch ( error ) {
			continue ;
		}
	}

	term( "^G^+Updated all repositories!^:\n" ) ;

	notifications.createNotification( {
		summary: 'wfm: success' ,
		body: "Updated all repositories!" ,
		icon: 'face-cool'
	} ).push() ;

	process.exit( 0 ) ;
}

module.exports = update ;



function checkGitStatus( state ) {
	return git.gitStatus( state ) ;
}



async function gitPull( state ) {
	term.bold.magenta( 'git pull\n' ) ;
	await execAsync( 'git pull' ) ;
}



async function npmInstall( state ) {
	term.bold.magenta( 'npm install\n' ) ;
	await execAsync( 'npm install' ) ;
}



function usage() {
	term( "Usage is: wfm update\n\n" ) ;
	term( '\n' ) ;
}

