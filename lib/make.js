/*
	The Cedric's Swiss Knife (CSK) - CSK wfm

	Copyright (c) 2015 - 2016 Cédric Ronvel 
	
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
//var execSync = require( 'child_process' ).execSync ;
var fs = require( 'fs' ) ;



var make = {} ;
module.exports = make ;



make.listRules = function listRules( state )
{
	var makefile , rules ;
	
	try {
		makefile = fs.readFileSync( state.cwd + '/Makefile' , 'utf8' ) ;
	}
	catch ( error ) {
		return ;
	}
	
	state.makefileRules = makefile.match( /^[a-zA-Z0-9.\/_-]+(?=:)/mg ) ;
	
	//console.log( "Makefile:" , state.makefileRules ) ;
	//process.exit() ;
} ;


