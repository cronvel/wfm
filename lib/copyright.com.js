/*
	WFM - Workflow Manager
	
	Copyright (c) 2015 - 2017 Cédric Ronvel
	
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
var glob = require( 'glob' ) ;

var async = require( 'async-kit' ) ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;
var notifications = require( 'freedesktop-notifications' ) ;

var wfm = require( './wfm.js' ) ;



/*
	wfm copyright
	
	Add the copyright notice on all .js files
*/



function copyright( args )
{
	var state = {} ;
	
	// Process arguments
	state.update = args._[ 0 ] === 'update' ;
	
	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;
	
	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}
	
	
	
	// Run the main process!
	
	
	async.series( [
		packageInfo ,
		writePackage ,
		patchFiles
	] )
	.using( [ state ] )
	.exec( function() {
		
		/*
		if ( state.tmpDirCleanupCallback ) { state.tmpDirCleanupCallback() ; }
		
		term.bold.green( "\n\nRepository " )
			.bold.italic.cyan( state.repositoryName )
			.bold.green( " was successfully duplicated!\n\n" ) ;
		
		notifications.createNotification( {
			summary: 'wfm: success' ,
			body: string.format( "Project <b>%s</b> was successfully duplicated!" , state.repositoryName ) ,
			icon: 'face-cool'
		} ).push() ;
		*/
		
		process.exit( 0 ) ;
	} ) ;
}

module.exports = copyright ;



function isObject( value )
{
	return value && typeof value === 'object' && ! Array.isArray( value ) ;
}



function packageInfo( state , callback )
{
	var comment , recall = packageInfo.bind( undefined , state , callback ) ;
	
	if ( ! isObject( state.package.copyright ) )
	{
		state.package.copyright = {} ;
		state.writePackage = true ;
	}
	
	if ( ! state.package.copyright.title || typeof state.package.copyright.title !== 'string' )
	{
		state.writePackage = true ;
		askForCopyrightTitle( state , recall ) ;
		return ;
	}
	
	if ( ! Array.isArray( state.package.copyright.years ) )
	{
		state.writePackage = true ;
		askForCopyrightYears( state , recall ) ;
		return ;
	}
	
	if ( ! state.package.copyright.owner || typeof state.package.copyright.owner !== 'string' )
	{
		state.writePackage = true ;
		
		if ( state.package.author && typeof state.package.author === 'string' )
		{
			state.package.copyright.owner = state.package.author ;
		}
		else if ( isObject( state.package.author ) && state.package.author.name && typeof state.package.author.name === 'string' )
		{
			state.package.copyright.owner = state.package.author.name ;
		}
		else
		{
			askForCopyrightOwner( state , recall ) ;
			return ;
		}
	}
	
	if ( ! state.package.license || typeof state.package.license !== 'string' )
	{
		state.writePackage = true ;
		askForLicense( state , recall ) ;
		return ;
	}
	
	if ( state.update )
	{
		state.package.copyright.years[ 1 ] = new Date().getFullYear() ;
		state.writePackage = true ;
	}
	
	
	try {
		state.licenseText = fs.readFileSync( __dirname + '/../data/licenses/' + state.package.license , 'utf8' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error loading license '%s': %s\n" , state.package.license , error ) ;
	}
	
	
	comment =
		state.package.copyright.title + '\n\n' +
		'Copyright (c) ' + state.package.copyright.years.join( ' - ' ) + ' ' + state.package.copyright.owner + '\n\n' +
		state.licenseText.trim() ;
	
	comment = '/*\n' + comment.replace( /^\t*/mg , '\t' ) + '\n*/\n' ;
	
	//console.log( 'Copyright comment:\n' , comment ) ;
	
	state.copyrightComment = comment ;
	
	callback() ;
}



function askForCopyrightTitle( state , callback )
{
	term.bold.brightYellow( 'Copyright title needed: ' ) ;
	
	var notif = notifications.createNotification( {
		summary: 'wfm: copyright title needed!' ,
		body: 'Copyright title needed!' ,
		icon: 'input-keyboard'
	} ) ;
	
	notif.push() ;
	
	term.inputField( function( error , input ) {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		
		input = input.trim() ;
		state.package.copyright.title = input ;
		
		callback() ;
	} ) ;
}



function askForCopyrightYears( state , callback )
{
	term( '^Y^+Copyright years needed ^K(YYYY or YYYY-YYYY)^Y^+: ^:' ) ;
	
	var notif = notifications.createNotification( {
		summary: 'wfm: copyright years needed!' ,
		body: 'Copyright years needed!' ,
		icon: 'input-keyboard'
	} ) ;
	
	notif.push() ;
	
	term.inputField( function( error , input ) {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		
		input = input.split( '-' ).slice( 0 , 2 ).map( e => parseInt( e.trim() , 10 ) ) ;
		
		if ( ! input[ 0 ] || ( input.length > 1 && ! input[ 1 ] ) )
		{
			state.package.copyright.years = null ;
			callback() ;
			return ;
		}
		
		state.package.copyright.years = input ;
		
		callback() ;
	} ) ;
}



function askForCopyrightOwner( state , callback )
{
	term.bold.brightYellow( 'Copyright owner needed: ' ) ;
	
	var notif = notifications.createNotification( {
		summary: 'wfm: copyright owner needed!' ,
		body: 'Copyright owner needed!' ,
		icon: 'input-keyboard'
	} ) ;
	
	notif.push() ;
	
	term.inputField( function( error , input ) {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		
		input = input.trim() ;
		state.package.copyright.owner = input ;
		
		callback() ;
	} ) ;
}



function askForLicense( state , callback )
{
	term.bold.brightYellow( 'License needed: ' ) ;
	
	var notif = notifications.createNotification( {
		summary: 'wfm: license needed!' ,
		body: 'License needed!' ,
		icon: 'input-keyboard'
	} ) ;
	
	notif.push() ;
	
	term.inputField( function( error , input ) {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		
		input = input.trim().toUpperCase() ;
		state.package.license = input ;
		
		callback() ;
	} ) ;
}



function patchFiles( state , callback )
{
	var files = [] ;
	
	try {
		files = files.concat(
			glob.sync( "lib/**/*.js" ) ,
			glob.sync( "sample/**/*.js" ) ,
			glob.sync( "test/**/*.js" )
		) ;
	}
	catch( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
	
	if ( ! files.length )
	{
		term.bold.magenta( 'no file to patch found...\n' ) ;
		callback() ;
		return ;
	}
	
	term.bold.magenta( 'patching files:\n' ) ;
	
	async.foreach( files , function( filePath , foreachCallback ) {
		
		term( '    %s: ' , filePath ) ;
		
		fs.readFile( filePath , 'utf8' , function( error , content ) {
			
			var newContent = content ;
			
			if ( error )
			{
				term.bold.red( "Read Error - %s\n" , error ) ;
				foreachCallback() ;
				return ;
			}
			
			newContent = newContent.replace( /^\s*(\/\*[^*]*\*\/\n)?/m , function( match , comment ) {
				
				if ( comment && ! comment.match( /[Cc]opyright/ ) )
				{
					return state.copyrightComment + comment ;
				}
				else
				{
					return state.copyrightComment ;
				}
			} ) ;
			
			//console.log( '\n\nThe file is now:' ) ; console.log( newContent ) ;
			
			if ( newContent === content )
			{
				term.bold.blue( "no change\n" ) ;
				foreachCallback() ;
				return ;
			}
			
			fs.writeFile( filePath , newContent , function( error ) {
				if ( error )
				{
					term.bold.red( "Write Error - %s\n" , error ) ;
					foreachCallback() ;
					return ;
				}
				
				term.bold.green( "OK\n" ) ;
				foreachCallback() ;
			} ) ;
		} ) ;
	} )
//	.parallel()
	.exec( function( error ) {
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		
		callback() ;
	} ) ;
}



function writePackage( state , callback )
{
	if ( ! state.writePackage ) { callback() ; return ; }
	
	term.bold.magenta( 'writing package.json\n' ) ;
	
	fs.writeFileSync( state.packagePath , wfm.packagify( state.package ) ) ;
	
	callback() ;
}



function usage()
{
	term( "Usage is: wfm copyright\n\n" ) ;
	term( '\n' ) ;
}

