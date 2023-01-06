/*
	WFM - Workflow Manager

	Copyright (c) 2015 - 2022 Cédric Ronvel

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
const execAsync = require( 'child_process' ).execAsync ;



const git = {} ;
module.exports = git ;



git.status = async function( state ) {
	var i , output , code , file ;

	output = ( await execAsync( 'git status --porcelain' ) ).toString().split( '\n' ) ;
	output.pop() ;

	state.gitUntrackedFiles = [] ;
	state.gitCleanWd = ! output.length ;

	//console.log( output ) ;

	for ( i = 0 ; i < output.length ; i ++ ) {
		code = output[ i ].slice( 0 , 2 ) ;
		file = output[ i ].slice( 3 ) ;

		switch ( code ) {
			case '??' :	// untracked
				state.gitUntrackedFiles.push( file ) ;
				break ;
			/*
			case ' M' :	// modified
			*/
		}
	}

	//console.log( "Clean WD:" , state.gitCleanWd ) ;
	//console.log( "Untracked files:" , state.gitUntrackedFiles ) ;
	//process.exit() ;
} ;



const MAIN_BRANCHES = new Set( [ 'master' , 'main' , 'stable' ] ) ;

git.branch = async function( state ) {
	state.gitBranch = ( await execAsync( "git branch | grep '*'" ) ).toString().slice( 2 ).trim() ;
	state.gitIsMainBranch = MAIN_BRANCHES.has( state.gitBranch ) ;
} ;

