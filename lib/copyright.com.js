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



const fs = require( 'fs' ) ;
const fsKit = require( 'fs-kit' ) ;

const Promise = require( 'seventh' ) ;

const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

const wfm = require( './wfm.js' ) ;



/*
	wfm copyright

	Add the copyright notice on all .js files
*/



async function copyright( args ) {
	var state = {} ;

	// Process arguments
	state.update = args.commandArgs[ 0 ] === 'update' ;

	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;

	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}

	await packageInfo( state ) ;
	await writePackage( state ) ;
	await patchFiles( state ) ;

	process.exit( 0 ) ;
}

module.exports = copyright ;



function isObject( value ) {
	return value && typeof value === 'object' && ! Array.isArray( value ) ;
}



async function packageInfo( state ) {
	var comment , toYear ;

	if ( ! isObject( state.package.copyright ) ) {
		state.package.copyright = {} ;
		state.writePackage = true ;
	}

	if ( ! state.package.copyright.title || typeof state.package.copyright.title !== 'string' ) {
		state.writePackage = true ;
		await askForCopyrightTitle( state ) ;
	}

	if ( ! Array.isArray( state.package.copyright.years ) ) {
		state.writePackage = true ;
		await askForCopyrightYears( state ) ;
	}

	if ( ! state.package.copyright.owner || typeof state.package.copyright.owner !== 'string' ) {
		state.writePackage = true ;

		if ( state.package.author && typeof state.package.author === 'string' ) {
			state.package.copyright.owner = state.package.author ;
		}
		else if ( isObject( state.package.author ) && state.package.author.name && typeof state.package.author.name === 'string' ) {
			state.package.copyright.owner = state.package.author.name ;
		}
		else {
			await askForCopyrightOwner( state ) ;
		}
	}

	if ( ! state.package.license || typeof state.package.license !== 'string' ) {
		state.writePackage = true ;
		await askForLicense( state ) ;
	}

	if ( state.update ) {
		toYear = new Date().getFullYear() ;

		if ( toYear !== state.package.copyright.years[ 0 ] && toYear !== state.package.copyright.years[ 1 ] ) {
			state.package.copyright.years[ 1 ] = new Date().getFullYear() ;
			state.writePackage = true ;
		}
	}


	try {
		state.licenseText = await fs.promises.readFile( __dirname + '/../data/licenses/' + state.package.license , 'utf8' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error loading license '%s': %s\n" , state.package.license , error ) ;
	}


	comment =
		state.package.copyright.title + '\n\n' +
		'Copyright (c) ' + state.package.copyright.years.join( ' - ' ) + ' ' + state.package.copyright.owner + '\n\n' +
		state.licenseText.trim() ;

	comment = '/*\n' + comment.replace( /^\t*/mg , '\t' ).replace( /^\s+$/mg , '' ) + '\n*/\n' ;

	//console.log( 'Copyright comment:\n' , comment ) ;

	state.copyrightComment = comment ;
}



function askForCopyrightTitle( state ) {
	term.bold.brightYellow( 'Copyright title needed: ' ) ;

	var notif = notifications.createNotification( {
		summary: 'wfm: copyright title needed!' ,
		body: 'Copyright title needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }

			input = input.trim() ;
			state.package.copyright.title = input ;

			resolve() ;
		} ) ;
	} ) ;
}



function askForCopyrightYears( state ) {
	term( '^Y^+Copyright years needed ^K(YYYY or YYYY-YYYY)^Y^+: ^:' ) ;

	var notif = notifications.createNotification( {
		summary: 'wfm: copyright years needed!' ,
		body: 'Copyright years needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }

			input = input.split( '-' ).slice( 0 , 2 )
				.map( e => parseInt( e.trim() , 10 ) ) ;

			if ( ! input[ 0 ] || ( input.length > 1 && ! input[ 1 ] ) ) {
				state.package.copyright.years = null ;
				resolve() ;
				return ;
			}

			state.package.copyright.years = input ;

			resolve() ;
		} ) ;
	} ) ;
}



function askForCopyrightOwner( state ) {
	term.bold.brightYellow( 'Copyright owner needed: ' ) ;

	var notif = notifications.createNotification( {
		summary: 'wfm: copyright owner needed!' ,
		body: 'Copyright owner needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }

			input = input.trim() ;
			state.package.copyright.owner = input ;

			resolve() ;
		} ) ;
	} ) ;
}



function askForLicense( state ) {
	term.bold.brightYellow( 'License needed: ' ) ;

	var notif = notifications.createNotification( {
		summary: 'wfm: license needed!' ,
		body: 'License needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }

			input = input.trim().toUpperCase() ;
			state.package.license = input ;

			resolve() ;
		} ) ;
	} ) ;
}



async function patchFiles( state ) {
	var filePath , files = [] , content , newContent ;

	try {
		files = files.concat(
			await fsKit.glob( "lib/**/*.js" ) ,
			await fsKit.glob( "src/**/*.js" ) ,
			await fsKit.glob( "sample/*.js" ) ,
			await fsKit.glob( "sample/!(node_modules)/**/*.js" ) ,
			await fsKit.glob( "test/**/*.js" )
		) ;
	}
	catch( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	if ( ! files.length ) {
		term.bold.magenta( 'no file to patch found...\n' ) ;
		return ;
	}

	term.bold.magenta( 'patching files:\n' ) ;

	for ( filePath of files ) {
		term( '    %s: ' , filePath ) ;

		try {
			content = await fs.promises.readFile( filePath , 'utf8' ) ;
		}
		catch ( error ) {
			term.bold.red( "Read Error - %s\n" , error ) ;
			continue ;
		}

		newContent = content ;

		newContent = newContent.replace( /^(#!.*\n)?\s*(\/\*[^*]*\*\/\n)?/m , ( match , shebang , comment ) => {
			shebang = shebang || '' ;

			if ( comment && ! comment.match( /[Cc]opyright/ ) ) {
				return shebang + state.copyrightComment + comment ;
			}

			return shebang + state.copyrightComment ;
		} ) ;

		//console.log( '\n\nThe file is now:' ) ; console.log( newContent ) ;

		if ( newContent === content ) {
			term.bold.blue( "no change\n" ) ;
			continue ;
		}

		try {
			await fs.promises.writeFile( filePath , newContent ) ;
		}
		catch ( error ) {
			term.bold.red( "Write Error - %s\n" , error ) ;
			continue ;
		}

		term.bold.green( "OK\n" ) ;
	}
}



function writePackage( state ) {
	if ( ! state.writePackage ) { return Promise.resolved ; }
	term.bold.magenta( 'writing package.json\n' ) ;
	return fs.promises.writeFile( state.packagePath , wfm.packagify( state.package ) ) ;
}



function usage() {
	term( "Usage is: wfm copyright\n\n" ) ;
	term( '\n' ) ;
}

