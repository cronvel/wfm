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
const execAsync = require( 'child_process' ).execAsync ;



const npm = {} ;
module.exports = npm ;



npm.updateIgnoreFile = async function( state ) {
	if ( ! await fsKit.isFile( './.npmignore' ) ) {
		await npm.createIgnoreFile( state ) ;
	}

	if ( ! await fsKit.isFile( './.gitignore' ) ) { return ; }

	var newNpmignore ,
		npmignore = await fs.promises.readFile( './.npmignore' , 'utf8' ) ,
		gitignore = await fs.promises.readFile( './.gitignore' , 'utf8' ) ;

	if ( npmignore.startsWith( '# +++ .gitignore\n' ) ) {
		newNpmignore = npmignore.replace( /^# \+\+\+ \.gitignore\n(.*)\n# --- \.gitignore\n/s , () => '# +++ .gitignore\n' + gitignore + '\n# --- .gitignore\n' ) ;
	}
	else {
		newNpmignore = '# +++ .gitignore\n' + gitignore + '\n# --- .gitignore\n' + npmignore ;
	}

	if ( ! newNpmignore.endsWith( '\n' ) ) { newNpmignore += '\n' ; }

	if ( ! state.npmCreatedIgnoreFile ) { newNpmignore = npm.enforceIgnoreFileList( newNpmignore ) ; }

	if ( newNpmignore !== npmignore ) {
		await fs.promises.writeFile( './.npmignore' , newNpmignore ) ;
		state.npmUpdatedIgnoreFile = true ;
	}
} ;



const DEFAULT_IGNORE = [
	'test' ,
	'log' ,
	'sample' ,
	'wfm.json'
] ;

npm.createIgnoreFile = async function( state ) {
	await fs.promises.writeFile( './.npmignore' , DEFAULT_IGNORE.join( '\n' ) + '\n' ) ;
	state.npmCreatedIgnoreFile = true ;
} ;



npm.enforceIgnoreFileList = function( npmIgnore ) {
	for ( let fileName of DEFAULT_IGNORE ) {
		if ( ! npmIgnore.includes( '\n' + fileName + '\n' ) ) {
			npmIgnore += fileName + '\n' ;
		}
	}

	return npmIgnore ;
} ;

