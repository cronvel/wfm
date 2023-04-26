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
//const fsKit = require( 'fs-kit' ) ;
//const path = require( 'path' ) ;

const Promise = require( 'seventh' ) ;

const semver = require( 'semver' ) ;
//const string = require( 'string-kit' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

const wfm = require( './wfm.js' ) ;
const git = require( './git.js' ) ;



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
	'rc' ,
	'release'
] ;



async function prepare( args ) {
	var state = {} ;

	// Process arguments
	state.message = args.message || args.m ;
	state.commit = args.commit || args.c ;
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

	if ( ! args.commandArgs.length ) {
		displayPreparationInfo( state ) ;
		if ( state.wfmJson.prepare?.nextVersion && state.wfmJson.prepare.nextVersion !== state.package.version ) {
			await writePackage( state ) ;
		}
		process.exit() ;
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
	await writeWfmJson( state ) ;
	await writePackage( state ) ;
	await gitCommit( state ) ;

	process.exit( 0 ) ;
}

module.exports = prepare ;



function writeWfmJson( state ) {
	if ( ! state.wfmJson.prepare ) { state.wfmJson.prepare = {} ; }

	var prepareData = state.wfmJson.prepare ;

	if ( ! prepareData.prereleaseCount ) { prepareData.prereleaseCount = 1 ; }
	else { prepareData.prereleaseCount ++ ; }

	if ( ! prepareData.fromVersion ) {
		prepareData.fromVersion =
			semver.prerelease( state.package.version ) ? state.package.version.replace( /-.*$/ , '' ) :
			state.package.version ;
	}

	if ( ! prepareData.forceVersionGte ) { prepareData.forceVersionGte = prepareData.fromVersion ; }

	if ( state.statusType ) {
		if ( ! prepareData.statusType ) {
			prepareData.statusType = state.statusType ;
		}
		else if ( prepareData.statusType > state.statusType ) {
			term.bold.yellow( "Switching back from a type %s to a type %s version: incrementing patch number...\n" , prepareData.statusType , state.statusType ) ;
			prepareData.forceVersionGte = semver.inc( prepareData.nextVersion.replace( /-.*$/ , '' ) , 'patch' ) ;
			prepareData.prereleaseCount = 1 ;
			prepareData.statusType = state.statusType ;
		}
		else if ( prepareData.statusType < state.statusType ) {
			prepareData.prereleaseCount = 1 ;
			prepareData.statusType = state.statusType ;
		}
		else if ( state.statusType === 'release' ) {
			term.bold.red( "A release was already prepared, waiting for publish !\n" ) ;
			process.exit( 1 ) ;
		}
	}
	else if ( ! prepareData.statusType ) {
		prepareData.statusType = 'alpha' ;
	}
	else if ( prepareData.statusType === 'release' ) {
		term.bold.red( "A release was already prepared, waiting for publish !\n" ) ;
		process.exit( 1 ) ;
	}

	if ( ! prepareData.releaseType ) {
		prepareData.releaseType = state.releaseType ;
	}
	else {
		// It's always the maximum type of release
		let releaseType = releaseValueToType[ Math.max( releaseTypeToValue[ prepareData.releaseType ] , releaseTypeToValue[ state.releaseType ] ) ] ;
		if ( releaseType !== prepareData.releaseType ) {
			prepareData.releaseType = releaseType ;
			prepareData.prereleaseCount = 1 ;
		}
	}

	buildVersion( state ) ;

	var entry = {
		type: state.releaseType ,
		message: state.message
	} ;

	if ( ! prepareData.entries ) { prepareData.entries = [] ; }
	prepareData.entries.push( entry ) ;

	term.bold.magenta( "next version: " ).brightYellow( prepareData.nextVersion )( '\n' ) ;
	term.bold.magenta( 'writing wfm.json\n' ) ;
	return fs.promises.writeFile( state.wfmJsonPath , JSON.stringify( state.wfmJson , null , '\t' ) + '\n' ) ;
}



function buildVersion( state ) {
	var prepareData = state.wfmJson.prepare ;

	var incType = prepareData.releaseType ;
	if ( incType === 'breaking' ) { incType = semver.major( prepareData.fromVersion ) >= 1 ? 'major' : 'minor' ; }
	else if ( incType === 'compatible' ) { incType = semver.major( prepareData.fromVersion ) >= 1 ? 'minor' : 'patch' ; }

	var version = prepareData.fromVersion ;
	version = semver.inc( version , incType ) ;
	if ( ! semver.gte( version , prepareData.forceVersionGte ) ) { version = prepareData.forceVersionGte ; }
	if ( prepareData.statusType !== 'release' ) { version += '-' + prepareData.statusType + '.' + prepareData.prereleaseCount ; }
	prepareData.nextVersion = version ;
}

prepare.buildVersion = buildVersion ;



function writePackage( state ) {
	state.package.version = state.wfmJson.prepare.nextVersion ;
	term.bold.magenta( 'writing package.json\n' ) ;
	return fs.promises.writeFile( state.packagePath , wfm.packagify( state.package ) ) ;
}



async function gitCommit( state ) {
	if ( ! state.commit ) { return ; }

	var commitMessage = state.message || 'commiting ' + state.releaseType + ' version' ;

	term.bold.magenta( 'git commit\n' ) ;

	try {
		await git.commit( state , commitMessage ) ;
	}
	catch ( error ) {
		// If there is nothing to commit, it's not an error here, just proceed anyway to the publish phase
		if ( error.nothingToCommit ) { return ; }

		wfm.exitError( "Error: %s\n" , error ) ;
	}
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



function displayPreparationInfo( state ) {
	if ( state.wfmJson.prepare?.nextVersion ) {
		term.bold.magenta( "next version: " ).brightYellow( state.wfmJson.prepare.nextVersion )( '\n\n' ) ;
	}
	else {
		term.bold.magenta( "next version: " ).red( "Not prepared!" )( '\n\n' ) ;
	}
}



function usage() {
	term( "Usage is: wfm prep[are] patch|compat[ible]|break[ing]|min[or]|maj[or] [alpha|beta|rc|release]\n\n" ) ;
	term( "\t--message , -m : specify a message\n" ) ;
	term( "\t--commit , -c  : git commit with the same message\n" ) ;
	term( '\n' ) ;
}

