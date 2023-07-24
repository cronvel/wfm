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
	await checkSymbolicLinkModules( state ) ;
	await upgrade( state ) ;
	await restoreSymbolicLinkModules( state ) ;
	await checkNodeEngine( state ) ;

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



async function checkSymbolicLinkModules( state ) {
	//if ( ! state.npmOutdated ) { return ; }

	term.bold.magenta( 'search symbolic link modules\n' ) ;

	try {
		await npm.listSymbolicLinkModules( state ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



async function restoreSymbolicLinkModules( state ) {
	if ( ! state.npmSymbolicLinkModules ) { return ; }

	term.bold.magenta( 'restore symbolic link modules\n' ) ;

	for ( let link of state.npmSymbolicLinkModules ) {
		let stats = await fs.promises.lstat( link.link ) ;

		if ( stats.isSymbolicLink() ) {
			term( "Link was preserved: %s\n" , link.link ) ;
			continue ;
		}

		term( "Restoring link %s --> %s\n" , link.link , link.linkTo ) ;
		await fsKit.deltree( link.link ) ;
		await fs.promises.link( link.linkTo , link.link ) ;
	}
}



async function upgrade( state ) {
	if ( ! state.npmOutdated ) { return ; }

	var outdatedList = Object.keys( state.npmOutdated ) ;
	term( "\n^c%i^ ^Ypackage(s) outdated:^ ^C%N^:\n\n" , outdatedList.length , outdatedList ) ;

	var installList = [] ,
		menuOptions = {
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
			installList.push( { name: depName , version: depInfo.wanted , type: depType } ) ;
			//await npm.install( state , depName , depInfo.wanted , depType ) ;
		}
		else if ( response.selectedIndex === 2 ) {
			installList.push( { name: depName , version: depInfo.latest , type: depType } ) ;
			//await npm.install( state , depName , depInfo.latest , depType ) ;
		}
	}

	if ( installList.length ) {
		term.bold.magenta( 'npm install\n' ) ;
		await npm.installMulti( state , installList ) ;
	}

	term( "\n" ) ;
}



async function checkNodeEngine( state ) {
	if ( ! state.package.dependencies ) { return ; }

	term.bold.magenta( 'checking node engine requirement\n' ) ;

	var currentMinVersion = '0.0.0' ;

	if ( state.package.engines?.node ) {
		currentMinVersion = semver.minVersion( state.package.engines.node ) ;
	}
	
	var requiredByDep ,
		newMinVersion = currentMinVersion ;

	var depList = Object.keys( state.package.dependencies ) ;

	for ( let depName of depList ) {
		let depPackage ,
			depPath = path.join( state.cwd , 'node_modules' , depName , 'package.json' ) ;

		//term( "%s\n" , depPath ) ;
		try {
			depPackage = require( depPath ) ;
		}
		catch ( error ) {
			term.red( "Package '%s' not installed\n" , depName ) ;
			continue ;
		}

		if ( ! depPackage.engines?.node ) { continue ; }
		
		let depMinVersion = semver.minVersion( depPackage.engines.node ) ;
		
		if ( semver.gt( depMinVersion , newMinVersion ) ) {
			newMinVersion = depMinVersion ;
			requiredByDep = depName ;
		}
	}
	
	if ( newMinVersion !== currentMinVersion ) {
		term(
			"^YMinimal node engine version should be changed! Current:^ ^C%s^:^Y, required: ^C%s^ ^y(forced by dependencies:^ ^/^c%s^:^y)^:\n^YApply?^ ^y[y|n]^ " ,
			currentMinVersion , newMinVersion , requiredByDep
		) ;
		let response = await term.yesOrNo().promise ;
		term( "\n" ) ;

		if ( response ) {
			if ( ! state.package.engines ) { state.package.engines = {} ; }
			state.package.engines.node = '>=' + newMinVersion ;
			term.bold.magenta( 'writing package.json\n' ) ;
			await fs.promises.writeFile( state.packagePath , wfm.packagify( state.package ) ) ;
		}
	}
} ;



function usage() {
	term( "Usage is: wfm [upgrade-]dep[endencies]\n\n" ) ;
	term( '\n' ) ;
}

