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
const path = require( 'path' ) ;

require( './patches.js' ) ;
const childProcess = require( 'child_process' ) ;
const spawn = childProcess.spawn ;
//const exec = childProcess.exec ;
const execAsync = childProcess.execAsync ;
//const execAsyncAll = childProcess.execAsyncAll ;

const Promise = require( 'seventh' ) ;

const semver = require( 'semver' ) ;
const string = require( 'string-kit' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

const wfm = require( './wfm.js' ) ;
const git = require( './git.js' ) ;
const npm = require( './npm.js' ) ;



async function test( args ) {
	var state = {} ;

	state.cwd = process.cwd() ;

	//await checkGit( state ) ;
	await checkNpmIgnoreFile( state ) ;

	term( "Test done.\n" ) ;

	/*
	notifications.createNotification( {
		summary: 'wfm: success' ,
		body: string.format( "Project <b>%s</b> <i>v%s</i> was successfully published!" , state.package.name , state.package.version ) ,
		icon: 'face-cool'
	} ).push() ;
	//*/

	process.exit( 0 ) ;
}

module.exports = test ;



async function checkGit( state ) {
	try {
		var gitPath = await fsKit.recursiveParentSearch( state.cwd , '.git' ) ;
	}
	catch ( error ) {
		wfm.exitError( "This is not a git repository.\n" ) ;
	}

	if ( path.dirname( gitPath ) !== state.cwd ) { state.gitRoot = gitPath ; }

	await git.branch( state ) ;
	term( "git branch: %s\n" , state.gitBranch ) ;
	term( "is main branch? %s\n" , state.gitIsMainBranch ) ;
}



async function checkNpmIgnoreFile( state ) {
	await npm.updateIgnoreFile( state ) ;
}

