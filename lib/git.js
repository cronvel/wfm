/*
	The Cedric's Swiss Knife (CSK) - CSK wfm

	Copyright (c) 2015 Cédric Ronvel 
	
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



// Load modules
var execSync = require( 'child_process' ).execSync ;
//var fs = require( 'fs' ) ;



var git = {} ;
module.exports = git ;



git.gitStatus = function gitStatus( state )
{
	var output , matches ;
	
	output = execSync( 'git status' ).toString() ;
	
	state.gitCleanWd = /nothing to commit/i.test( output ) && /working directory clean/i.test( output ) ;
	
	if ( ! state.gitCleanWd && /untracked file/i.test( output ) )
	{
		matches = output.match( /\nUntracked files:\n[^\n]*\n\n((\t[^\n]+\n)+)\n/ ) ;
		
		state.gitUntrackedFiles = matches[ 1 ].split( '\n' ).slice( 0 , -1 ).map( function( file ) {
			return file.trim() ;
		} ) ;
	}
	
	//console.log( "Clean WD:" , state.gitCleanWd ) ;
	//console.log( "Untracked files:" , state.gitUntrackedFiles ) ;
	//process.exit() ;
} ;



