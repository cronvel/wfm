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
const npm = require( './npm.js' ) ;



async function upgradeDependencies( args ) {
	var state = {} ;

	// Process arguments
	//state.message = args.message || args.m ;
	//state.commit = args.commit || args.c ;
	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;
	//state.wfmJsonPath = state.cwd + '/wfm.json' ;

	// Preliminary check

	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}

	await npmOutdate( state ) ;
	await upgrade( state ) ;

	process.exit( 0 ) ;
}

module.exports = upgradeDependencies ;



async function npmOutdate( state ) {
	term.bold.magenta( 'npm outdate\n' ) ;

	try {
		await npm.outdate( state ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



async function upgrade( state ) {
	if ( ! state.npmOutdated ) { return ; }

	var outdatedList = Object.keys( state.npmOutdated ) ;
	term( "\n^c%i^ ^Ypackage(s) outdated:^ ^C%N^:\n\n" , outdatedList.length , outdatedList ) ;

	var menuOptions = {
		selectedIndex: 0
		//style: term.inverse ,
		//selectedStyle: term.dim.blue.bgGreen
	} ;

	for ( let depName of outdatedList ) {
		let depInfo = state.npmOutdated[ depName ] ;
		let depType =
			state.package.dependencies?.[ depName ] ? 'core' :
			state.package.devDependencies?.[ depName ] ? 'dev' :
			'other' ;

		term( "^YDependency^ ^/^C%s^ (^m%s^:) -- ^Ycurrent:^ ^C%s^ ; ^Ywanted:^ ^C%s^ ; ^Ylatest:^ ^C%s^:" ,
			depName , depType , depInfo.current , depInfo.wanted , depInfo.latest
		) ;

		let menuItems = [
			'Keep current v' + depInfo.current ,
			'Upgrade to wanted v' + depInfo.wanted ,
			'Upgrade to latest v' + depInfo.latest
		] ;

		var response = await term.singleLineMenu( menuItems , menuOptions ).promise ;
		term.column( 0 ).eraseLineAfter() ;

		menuOptions.selectedIndex = response.selectedIndex ;

		if ( response.selectedIndex === 1 ) {
			await npm.install( state , depName , depInfo.wanted , depType ) ;
		}
		else if ( response.selectedIndex === 2 ) {
			await npm.install( state , depName , depInfo.latest , depType ) ;
		}
	}

	term( "\n" ) ;
}



function usage() {
	term( "Usage is: wfm [upgrade-]dep[endencies]\n\n" ) ;
	term( '\n' ) ;
}

