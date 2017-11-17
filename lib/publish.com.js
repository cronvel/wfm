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
var fsKit = require( 'fs-kit' ) ;
var path = require( 'path' ) ;
var exec = require( 'child_process' ).exec ;
var execSync = require( 'child_process' ).execSync ;

var semver = require( 'semver' ) ;
var string = require( 'string-kit' ) ;
var async = require( 'async-kit' ) ;
var termkit = require( 'terminal-kit' ) ;
var term = termkit.terminal ;
var notifications = require( 'freedesktop-notifications' ) ;

var wfm = require( './wfm.js' ) ;
var git = require( './git.js' ) ;
var make = require( './make.js' ) ;



var releaseTypeWord = [
	'patch' ,
	'minor' ,
	'major' ,
	'compatible' ,
	'breaking' ,
	'again'
] ;



var releaseTypeAlias = {
	min: 'minor' ,
	maj: 'major' ,
	compat: 'compatible' ,
	break: 'breaking'
} ;



function publish( args ) {
	var state = {} ;

	// Process arguments
	state.message = args.message || args.m ;


	state.releaseType = releaseTypeAlias[ args._[ 0 ] ] || args._[ 0 ] ;
	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;

	// Preliminary check

	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}

	if ( releaseTypeWord.indexOf( state.releaseType ) === -1 ) {
		usage() ;
		process.exit() ;
	}

	if ( state.releaseType === 'breaking' ) { state.releaseType = semver.major( state.package.version ) >= 1 ? 'major' : 'minor' ; }
	if ( state.releaseType === 'compatible' ) { state.releaseType = semver.major( state.package.version ) >= 1 ? 'minor' : 'patch' ; }



	// Run the main process!


	async.series( [
		checkGit ,
		checkGitStatus ,
		checkFeatures ,

		jshint ,
		eslint ,
		unitTest ,

		askForGitRoot ,
		askForGitAdd ,
		askForMessage ,

		packageVersion ,

		writePackage ,
		build ,
		buildReadme ,
		writeChangelog ,
		gitAddUntrackedFiles ,

		gitCommit ,
		gitTag ,

		//gitPush ,
		//npmPublish
		parallelPublish
	] )
	.using( [ state ] )
	.exec( () => {
		term.bold.green( "\n\nProject " )
		.bold.italic.cyan( state.package.name )
		.brightYellow( ' v' + state.package.version )
		.bold.green( " was successfully published!\n\n" ) ;

		notifications.createNotification( {
			summary: 'wfm: success' ,
			body: string.format( "Project <b>%s</b> <i>v%s</i> was successfully published!" , state.package.name , state.package.version ) ,
			icon: 'face-cool'
		} ).push() ;

		process.exit( 0 ) ;
	} ) ;
}

module.exports = publish ;



function checkGit( state , callback ) {
	fsKit.recursiveParentSearch( state.cwd , '.git' , ( error , gitPath ) => {
		if ( error ) { wfm.exitError( "This is not a git repository.\n" ) ; }
		if ( path.dirname( gitPath ) !== state.cwd ) { state.gitRoot = gitPath ; }
		callback() ;
	} ) ;
}



function checkGitStatus( state , callback ) {
	git.gitStatus( state ) ;
	callback() ;
}



function checkFeatures( state , callback ) {
	var paths = {
		changelog: 'CHANGELOG' ,
		makefile: 'Makefile' ,
		jshint: '.jshintrc' ,
		eslint: '.eslintrc.js' ,
		gitignore: '.gitignore'
	} ;

	var subFeatures = {
		makefile: make.listRules
	} ;

	async.map( paths , ( path_ , feature , mapCallback ) => {
		fs.access( state.cwd + '/' + path_ , fs.R_OK | fs.W_OK , ( error ) => {
			if ( error ) { mapCallback( undefined , false ) ; return ; }
			if ( ! subFeatures[ feature ] ) { mapCallback( undefined , true ) ; return ; }

			subFeatures[ feature ]( state ) ;
			mapCallback( undefined , true ) ;
		} ) ;
	} )
	.exec( ( error , pathExists ) => {

		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		state.has = pathExists ;
		callback() ;
	} ) ;
}



function askForGitRoot( state , callback ) {
	var notif , controller , answered = false ;

	if ( ! state.gitRoot ) { callback() ; return ; }

	term( '\n^Y^+The root of the git repo is different from CWD^ ^Y^/(%s)^:^Y^+, proceed anyway? [y/n] ' , state.gitRoot ) ;

	notif = notifications.createNotification( {
		summary: 'wfm: git root different from CWD?' ,
		body: 'The root of the git repo is different from CWD (' + state.gitRoot + '), proceed anyway?' ,
		icon: 'dialog-question' ,
		actions: {
			yes: 'Yes' ,
			no: 'No'
		}
	} ) ;

	notif.on( 'action' , ( answer ) => {
		if ( answered ) { return ; }
		controller.abort() ;
		term( '%s\n' , answer ) ;
		if ( answer === 'no' ) { wfm.exitError( "Publish was aborted!\n" ) ; }
		callback() ;
	} ) ;

	notif.push() ;

	controller = term.yesOrNo( ( error , answer ) => {
		if ( answered ) { return ; }
		notif.close() ;
		term( '\n' ) ;
		if ( error || ! answer ) { wfm.exitError( "Publish was aborted!\n" ) ; }
		callback() ;
	} ) ;
}



function askForGitAdd( state , callback ) {
	var k , notif , controller , answered = false ;

	if ( ! state.gitUntrackedFiles || ! state.gitUntrackedFiles.length ) { callback() ; return ; }

	term.bold.magenta( '\nThere are untracked files:\n' ) ;

	for ( k in state.gitUntrackedFiles ) {
		term.blue( '  %s\n' , state.gitUntrackedFiles[ k ] ) ;
	}

	term.italic.bold.brightYellow( '\ngit add' ).bold.brightYellow( ' all those files? [y/n] ' ) ;

	notif = notifications.createNotification( {
		summary: 'wfm: git add files?' ,
		body: 'There are untracked files: \n' + state.gitUntrackedFiles.join( ', ' ) + '\n<b><i>git add</i> all those files?</b>' ,
		icon: 'dialog-question' ,
		actions: {
			yes: 'Yes' ,
			no: 'No'
		}
	} ) ;

	notif.on( 'action' , ( answer ) => {
		if ( answered ) { return ; }
		controller.abort() ;
		term( '%s\n' , answer ) ;
		if ( answer === 'no' ) { wfm.exitError( "I will not publish an unclean Working Directory!\n" ) ; }
		callback() ;
	} ) ;

	notif.push() ;

	controller = term.yesOrNo( ( error , answer ) => {
		if ( answered ) { return ; }
		notif.close() ;
		term( '\n' ) ;
		if ( error || ! answer ) { wfm.exitError( "I will not publish an unclean Working Directory!\n" ) ; }
		callback() ;
	} ) ;
}



function askForMessage( state , callback ) {
	if ( state.message ) { callback() ; return ; }

	if ( ! state.gitCleanWd ) {
		term.bold.brightYellow( 'Your working directory contains changes to be commited, please enter a message:\n' ) ;
	}
	else if ( state.has.changelog ) {
		term.bold.brightYellow( 'You have a CHANGELOG file, please enter a message:\n' ) ;
	}
	else {
		callback() ;
		return ;
	}

	var notif = notifications.createNotification( {
		summary: 'wfm: message needed!' ,
		body: 'A message is needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	term.inputField( ( error , input ) => {
		notif.close() ;
		term( '\n\n' ) ;
		if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
		state.message = input ;
		callback() ;
	} ) ;
}



function jshint( state , callback ) {
	if ( ! state.has.jshint ) { callback() ; return ; }

	term.bold.magenta( 'jshint\n' ) ;

	// The verbose option print error codes
	exec( 'jshint --verbose lib/*js' , ( error , stdout ) => {

		var i , jshintRealErrors = [] ;

		if ( error ) {
			stdout = stdout.trim().split( '\n' ) ;

			// Remove non-critical error like unused variable
			for ( i = 0 ; i < stdout.length ; i ++ ) {
				if ( stdout[ i ].indexOf( ':' ) >= 0 &&
					! /is defined but never used/.test( stdout[ i ] )
				) {
					jshintRealErrors.push( stdout[ i ] ) ;
				}
			}

			if ( jshintRealErrors.length ) { wfm.exitError( "Jshint errors:\n%s\n" , jshintRealErrors.join( '\n' ) ) ; }
		}

		callback() ;
	} ) ;
}



function eslint( state , callback ) {
	if ( ! state.has.eslint ) { callback() ; return ; }

	term.bold.magenta( 'eslint\n' ) ;

	// The verbose option print error codes
	exec( 'eslint "lib/**/*.js"' , ( error , stdout , stderr ) => {

		if ( error ) {
			wfm.exitError( "ESLint errors:\n%s\n" , stdout ) ;
		}

		callback() ;
	} ) ;
}



function unitTest( state , callback ) {
	if ( ! state.package.scripts || ! state.package.scripts.test ) { callback() ; return ; }

	term.bold.magenta( 'Unit test: %s\n' , state.package.scripts.test.trim().split( ' ' )[ 0 ] ) ;

	// Turn grab input off, so CTRL-C can send SIGINT again
	term.grabInput( false ) ;

	try {
		execSync( state.package.scripts.test , { stdio: [ 0 , 1 , 2 ] } ) ;
	}
	catch ( error ) {
		wfm.exitError( "%s\n" , error ) ;
	}

	term.grabInput() ;
	callback() ;
}



function packageVersion( state , callback ) {
	switch ( state.releaseType ) {
		case 'patch' :
		case 'minor' :
		case 'major' :
			state.package.version = semver.inc( state.package.version , state.releaseType ) ;
			state.writePackage = true ;
			term.bold.magenta( "new version: " ).brightYellow( state.package.version )( '\n' ) ;
			break ;
		case 'again' :
			term.bold.magenta( "version: " ).brightYellow( state.package.version )( '\n' ) ;
			break ;
	}

	callback() ;
}



function build( state , callback ) {
	if ( ! state.has.makefile || state.makefileRules.indexOf( 'build' ) === -1 ) { callback() ; return ; }

	term.bold.magenta( 'building project\n' ) ;

	try {
		execSync( 'make build' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	callback() ;
}



function buildReadme( state , callback ) {
	if ( ! state.has.makefile || state.makefileRules.indexOf( 'README.md' ) === -1 ) { callback() ; return ; }

	term.bold.magenta( 'building README.md\n' ) ;

	try {
		execSync( 'make README.md' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	callback() ;
}



function writePackage( state , callback ) {
	if ( ! state.writePackage ) { callback() ; return ; }

	term.bold.magenta( 'writing package.json\n' ) ;

	fs.writeFileSync( state.packagePath , wfm.packagify( state.package ) ) ;

	callback() ;
}



function writeChangelog( state , callback ) {
	if ( ! state.has.changelog ) { callback() ; return ; }

	var header , content ;

	term.bold.magenta( 'writing CHANGELOG\n' ) ;

	content = fs.readFileSync( state.cwd + '/CHANGELOG' ).toString() ;

	header = 'v' + state.package.version ;
	header += '\n' + '-'.repeat( header.length ) + '\n\n' ;

	content = '\n' + header + state.message + '\n\n' + content ;

	fs.writeFileSync( state.cwd + '/CHANGELOG' , content ) ;

	callback() ;
}



function gitAddUntrackedFiles( state , callback ) {
	var commandArgs ;

	if ( ! state.gitUntrackedFiles || ! state.gitUntrackedFiles.length ) { callback() ; return ; }

	term.bold.magenta( 'git add untracked files\n' ) ;

	commandArgs = state.gitUntrackedFiles.map( string.escape.shellArg ).join( ' ' ) ;

	try {
		execSync( 'git add ' + commandArgs ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	callback() ;
}



function gitCommit( state , callback ) {
	var commitMessage = state.message || 'publishing ' + state.releaseType + ' version' ;

	term.bold.magenta( 'git commit\n' ) ;

	try {
		execSync( 'git commit -am ' + string.escape.shellArg( commitMessage ) ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	callback() ;
}



function gitTag( state , callback ) {
	term.bold.magenta( 'git tag\n' ) ;

	try {
		execSync( 'git tag v' + state.package.version +
			' -a -m v' + state.package.version +
			' -m ' + string.escape.shellArg( state.message || '' )
		) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}

	callback() ;
}



function gitPush( state , callback ) {
	if ( state.parallelPublish ) { term( '* ' ) ; }
	term.bold.magenta( 'git push\n' ) ;

	exec( 'git push --follow-tags' , ( error , stdout , stderr ) => {

		if ( error ) { wfm.exitError( "git push error %s:\n%s\n" , error , stderr ) ; }
		callback() ;
	} ) ;
}



function npmPublish( state , callback ) {
	if ( state.package.private ) { callback() ; return ; }

	if ( state.parallelPublish ) { term( '* ' ) ; }
	term.bold.magenta( 'npm publish\n' ) ;

	exec( 'npm publish' , ( error , stdout , stderr ) => {

		if ( error ) { wfm.exitError( "npm publish error %s:\n%s\n" , error , stderr ) ; }
		callback() ;
	} ) ;
}



function parallelPublish( state , callback ) {
	term.bold.magenta( 'publish in parallele mode:\n' ) ;

	state.parallelPublish = true ;

	async.parallel( [
		gitPush ,
		npmPublish
	] )
	.using( [ state ] )
	.exec( callback ) ;
}



function usage() {
	term( "Usage is: wfm pub[lish] patch|min[or]|maj[or]|again|compat[ible]|break[ing]\n\n" ) ;
	term( "\t--message , -m : specify a message\n" ) ;
	term( '\n' ) ;
}

