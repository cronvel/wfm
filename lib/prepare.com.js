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
const make = require( './make.js' ) ;



const releaseTypeWord = [
	'patch' ,
	'minor' ,
	'major' ,
	'compatible' ,
	'breaking'
] ;



const releaseTypeAlias = {
	min: 'minor' ,
	maj: 'major' ,
	compat: 'compatible' ,
	break: 'breaking'
} ;



const releaseValueToType = [ 'patch' , 'compatible' , 'breaking' ] ;
const releaseTypeToValue = { patch: 0 , compatible: 1 , breaking: 2 } ;



const statusTypeWord = [
	'alpha' ,
	'beta' ,
	'rc'
] ;



async function prepare( args ) {
	var state = {} ;

	// Process arguments
	state.message = args.message || args.m ;
	state.releaseType = releaseTypeAlias[ args.commandArgs[ 0 ] ] || args.commandArgs[ 0 ] ;
	state.statusType = args.commandArgs[ 1 ] || null ;
	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;
	state.wfmJsonPath = state.cwd + '/wfm.json' ;

	// Preliminary check

	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}

	try {
		state.wfmJson = require( state.wfmJsonPath ) ;
	}
	catch ( error ) {
		state.wfmJson = {} ;
	}

	if ( ! releaseTypeWord.includes( state.releaseType ) ) {
		usage() ;
		process.exit() ;
	}

	if ( state.releaseType === 'major' ) { state.releaseType = 'breaking' ; }
	else if ( state.releaseType === 'minor' ) { state.releaseType = semver.major( state.package.version ) >= 1 ? 'compatible' : 'breaking' ; }

	if ( state.statusType && ! statusTypeWord.includes( state.statusType ) ) {
		usage() ;
		process.exit() ;
	}

	await askForMessage( state ) ;
	await writePrepareData( state ) ;

	process.exit( 0 ) ;
}

module.exports = prepare ;



function writePrepareData( state ) {
	if ( ! state.wfmJson.prepare ) { state.wfmJson.prepare = {} ; }

	var prepare = state.wfmJson.prepare ;

	if ( state.statusType ) { prepare.statusType = state.statusType ; }
	else if ( ! prepare.statusType ) { prepare.statusType = 'alpha' ; }

	if ( ! prepare.fromVersion ) { prepare.fromVersion = state.package.version ; }

	if ( ! prepare.prereleaseCount ) { prepare.prereleaseCount = 1 ; }
	else { prepare.prereleaseCount ++ ; }

	if ( ! prepare.releaseType ) {
		prepare.releaseType = state.releaseType ;
	}
	else {
		// It's always the maximum type of release
		prepare.releaseType = releaseValueToType[ Math.max( releaseTypeToValue[ prepare.releaseType ] , releaseTypeToValue[ state.releaseType ] ) ] ;
	}

	var incType = prepare.releaseType ;
	if ( incType === 'breaking' ) { incType = semver.major( prepare.fromVersion ) >= 1 ? 'major' : 'minor' ; }
    else if ( incType === 'compatible' ) { incType = semver.major( prepare.fromVersion ) >= 1 ? 'minor' : 'patch' ; }

	prepare.nextVersion = semver.inc( prepare.fromVersion , incType ) + '-' + prepare.statusType + '.' + prepare.prereleaseCount ;
	//state.package.version = prepare.nextVersion ;

	var entry = {
		type: state.releaseType ,
		message: state.message
	} ;

	if ( ! prepare.entries ) { prepare.entries = [] ; }
	prepare.entries.push( entry ) ;

	return fs.promises.writeFile( state.wfmJsonPath , JSON.stringify( state.wfmJson , null , '\t' ) ) ;
}



function askForMessage( state ) {
	if ( state.message ) { return Promise.resolved ; }

	term.bold.brightYellow( 'Enter a changelog entry:\n' ) ;

	var notif = notifications.createNotification( {
		summary: 'wfm: message needed!' ,
		body: 'A message is needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
			state.message = input ;
			resolve() ;
		} ) ;
	} ) ;
}



function usage() {
	term( "Usage is: wfm prep[are] patch|compat[ible]|break[ing]|min[or]|maj[or] [alpha|beta|rc]\n\n" ) ;
	term( "\t--message , -m : specify a message\n" ) ;
	term( '\n' ) ;
}

