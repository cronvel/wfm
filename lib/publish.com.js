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
var fs = require( 'fs' ) ;
var exec = require( 'child_process' ).execSync ;

var semver = require( 'semver' ) ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;

var wfm = require( './wfm.js' ) ;



function publish( args )
{
	var cwd , packagePath , package , releaseType ;
	
	releaseType = args._[ 0 ] ;
	cwd = process.cwd() ;
	packagePath = cwd + '/package.json' ;
	
	try {
		package = require( packagePath ) ;
	}
	catch ( error ) {
		term( "No package.json found.\n" ) ;
		process.exit() ;
	}
	
	if ( package.private )
	{
		term.bold.red( "I will not publish this private repository!\n" ) ;
		process.exit() ;
	}
	
	switch ( releaseType )
	{
		case 'patch' :
		case 'minor' :
		case 'major' :
			package.version = semver.inc( package.version , releaseType ) ;
			term( "New version: %s\n" , package.version ) ;
			break ;
		default :
			usage() ;
			process.exit() ;
	}
	
	fs.writeFileSync( packagePath , wfm.packagify( package ) ) ;
	
	try {
		exec( 'git commit -am "publishing ' + releaseType + ' version"' ) ;
	}
	catch ( error ) {
		term( "Error: %s\n" , error ) ;
	}
	
	try {
		exec( 'git tag v' + package.version ) ;
	}
	catch ( error ) {
		term( "Error: %s\n" , error ) ;
	}
	
	try {
		exec( 'git push' )
		exec( 'git push --tags' ) ;
	}
	catch ( error ) {
		term( "Error: %s\n" , error ) ;
	}
	
	try {
		exec( 'npm publish' )
	}
	catch ( error ) {
		term( "Error: %s\n" , error ) ;
	}
	
	term.bold.green( "Project " )
		.bold.italic.cyan( package.name )
		.brightYellow( ' v' + package.version )
		.bold.green( " was successfully published!\n" ) ;
} ;

module.exports = publish ;


function usage()
{
	term( "Usage is: wfm publish patch|minor|major\n" ) ;
}

