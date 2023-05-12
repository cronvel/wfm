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
const childProcess = require( 'child_process' ) ;
const spawn = childProcess.spawn ;
//const exec = childProcess.exec ;
const execAsync = childProcess.execAsync ;
//const execAsyncAll = childProcess.execAsyncAll ;

const Promise = require( 'seventh' ) ;

const semver = require( 'semver' ) ;
const string = require( 'string-kit' ) ;
const termkit = require( 'terminal-kit' ) ;
const term = termkit.terminal ;
const notifications = require( 'freedesktop-notifications' ) ;

const wfm = require( './wfm.js' ) ;
const git = require( './git.js' ) ;
const npm = require( './npm.js' ) ;
const make = require( './make.js' ) ;



const releaseTypeWord = [
	'patch' ,
	'minor' ,
	'major' ,
	'compatible' ,
	'breaking' ,
	'again'
] ;



const releaseTypeAlias = {
	min: 'minor' ,
	maj: 'major' ,
	compat: 'compatible' ,
	break: 'breaking'
} ;



async function publish( args ) {
	var state = {} ;

	// Process arguments
	state.message = args.message || args.m ;
	state.releaseType = releaseTypeAlias[ args.commandArgs[ 0 ] ] || args.commandArgs[ 0 ] ;
	state.cwd = process.cwd() ;
	state.packagePath = state.cwd + '/package.json' ;
	state.wfmJsonPath = state.cwd + '/wfm.json' ;

	// Preliminary check

	try {
		state.package = require( state.packagePath ) ;
	}
	catch ( error ) {
		wfm.exitError( "No package.json found.\n" ) ;
	}

	try {
		state.wfmJson = require( state.wfmJsonPath ) ;
	}
	catch ( error ) {
		state.wfmJson = {} ;
	}

	if ( state.wfmJson.prepare?.releaseType ) {
		state.releaseType = state.wfmJson.prepare.releaseType ;
	}
	else if ( ! releaseTypeWord.includes( state.releaseType ) ) {
		usage() ;
		process.exit() ;
	}

	if ( state.releaseType === 'breaking' ) { state.releaseType = semver.major( state.package.version ) >= 1 ? 'major' : 'minor' ; }
	else if ( state.releaseType === 'compatible' ) { state.releaseType = semver.major( state.package.version ) >= 1 ? 'minor' : 'patch' ; }

	await checkGit( state ) ;
	await updateNpmIgnoreFile( state ) ;
	await checkGitStatus( state ) ;
	await checkFeatures( state ) ;

	await jshint( state ) ;
	await eslint( state ) ;
	await unitTest( state ) ;

	await build( state ) ;
	await buildReadme( state ) ;

	await askForGitRoot( state ) ;
	await askForGitAdd( state ) ;
	await askForMessage( state ) ;

	await packageVersion( state ) ;
	await writePackage( state ) ;
	await writeChangelog( state ) ;
	await writeWfmJson( state ) ;

	await gitAddUntrackedFiles( state ) ;
	await gitCommit( state ) ;
	await gitTag( state ) ;

	//await gitPush( state ) ;
	//await npmPublish( state ) ;
	await parallelPublish( state ) ;

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
}

module.exports = publish ;



async function checkGit( state ) {
	try {
		var gitPath = await fsKit.recursiveParentSearch( state.cwd , '.git' ) ;
	}
	catch ( error ) {
		wfm.exitError( "This is not a git repository.\n" ) ;
	}

	if ( path.dirname( gitPath ) !== state.cwd ) { state.gitRoot = gitPath ; }
}



async function checkGitStatus( state ) {
	await git.status( state ) ;
	await git.branch( state ) ;

	if ( ! state.gitIsMainBranch ) {
		wfm.exitError( "This is not the main branch\n" ) ;
	}
}



async function checkFeatures( state ) {
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

	var pathExists = await Promise.mapObject( paths , async ( path_ , feature ) => {
		try {
			await fs.promises.access( state.cwd + '/' + path_ , fs.R_OK | fs.W_OK ) ;
		}
		catch ( error ) {
			return false ;
		}

		if ( subFeatures[ feature ] ) {
			try {
				await subFeatures[ feature ]( state ) ;
			}
			catch ( error ) {}	// ignore errors here
		}

		return true ;
	} ) ;

	state.has = pathExists ;
}



async function updateNpmIgnoreFile( state ) {
	await npm.updateIgnoreFile( state ) ;

	if ( state.npmCreatedIgnoreFile ) {
		let notif , controller , answered = false ;

		term( '\n^Y^+A .npmignore file was created, proceed anyway? [y/n] ' ) ;

		notif = notifications.createNotification( {
			summary: 'wfm: A .npmignore file was created, proceed anyway?' ,
			body: 'A .npmignore file was created, proceed anyway?' ,
			icon: 'dialog-question' ,
			actions: {
				yes: 'Yes' ,
				no: 'No'
			}
		} ) ;

		return new Promise( resolve => {
			notif.on( 'action' , ( answer ) => {
				if ( answered ) { return ; }
				controller.abort() ;
				term( '%s\n' , answer ) ;
				if ( answer === 'no' ) { wfm.exitError( "Publish was aborted!\n" ) ; }
				resolve() ;
			} ) ;

			notif.push() ;

			controller = term.yesOrNo( ( error , answer ) => {
				if ( answered ) { return ; }
				notif.close() ;
				term( '\n' ) ;
				if ( error || ! answer ) { wfm.exitError( "Publish was aborted!\n" ) ; }
				resolve() ;
			} ) ;
		} ) ;
	}
	else if ( state.npmUpdatedIgnoreFile ) {
		term( '\n^m^+updated the .npmignore file\n' ) ;
	}
}



function askForGitRoot( state ) {
	var notif , controller , answered = false ;

	if ( ! state.gitRoot ) { return Promise.resolved ; }

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

	return new Promise( resolve => {
		notif.on( 'action' , ( answer ) => {
			if ( answered ) { return ; }
			controller.abort() ;
			term( '%s\n' , answer ) ;
			if ( answer === 'no' ) { wfm.exitError( "Publish was aborted!\n" ) ; }
			resolve() ;
		} ) ;

		notif.push() ;

		controller = term.yesOrNo( ( error , answer ) => {
			if ( answered ) { return ; }
			notif.close() ;
			term( '\n' ) ;
			if ( error || ! answer ) { wfm.exitError( "Publish was aborted!\n" ) ; }
			resolve() ;
		} ) ;
	} ) ;
}



function askForGitAdd( state ) {
	var k , notif , controller , answered = false ;

	if ( ! state.gitUntrackedFiles || ! state.gitUntrackedFiles.length ) { return Promise.resolved ; }

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

	return new Promise( resolve => {
		notif.on( 'action' , ( answer ) => {
			if ( answered ) { return ; }
			controller.abort() ;
			term( '%s\n' , answer ) ;
			if ( answer === 'no' ) { wfm.exitError( "I will not publish an unclean Working Directory!\n" ) ; }
			resolve() ;
		} ) ;

		notif.push() ;

		controller = term.yesOrNo( ( error , answer ) => {
			if ( answered ) { return ; }
			notif.close() ;
			term( '\n' ) ;
			if ( error || ! answer ) { wfm.exitError( "I will not publish an unclean Working Directory!\n" ) ; }
			resolve() ;
		} ) ;
	} ) ;
}



function askForMessage( state ) {
	if ( state.message ) { return Promise.resolved ; }

	if ( ! state.gitCleanWd ) {
		term.bold.brightYellow( 'Your working directory contains changes to be commited, please enter a message:\n' ) ;
	}
	else if ( state.has.changelog ) {
		term.bold.brightYellow( 'You have a CHANGELOG file, please enter a message:\n' ) ;
	}
	else {
		return Promise.resolved ;
	}

	var notif = notifications.createNotification( {
		summary: 'wfm: message needed!' ,
		body: 'A message is needed!' ,
		icon: 'input-keyboard'
	} ) ;

	notif.push() ;

	return new Promise( resolve => {
		term.inputField( ( error , input ) => {
			notif.close() ;
			term( '\n\n' ) ;
			if ( error ) { wfm.exitError( "Error: %s\n" , error ) ; }
			state.message = input ;
			resolve() ;
		} ) ;
	} ) ;
}



async function jshint( state ) {
	var stdout , stderr , lines , i , jshintRealErrors = [] ;

	if ( ! state.has.jshint ) { return ; }

	term.bold.magenta( 'JSHint: ' ) ;

	try {
		var child = spawn( 'jshint --verbose lib/*js' , { shell: true } ) ;

		child.stdout.on( 'data' , chunk => stdout += chunk ) ;
		child.stderr.on( 'data' , chunk => stderr += chunk ) ;

		var exit = await Promise.onceEventOrError( child , 'exit' ) ;

		if ( exit ) {
			lines = stdout.trim().split( '\n' ) ;

			// Remove non-critical error like unused variable
			for ( i = 0 ; i < lines.length ; i ++ ) {
				if ( lines[ i ].indexOf( ':' ) >= 0 && ! /is defined but never used/.test( lines[ i ] ) ) {
					jshintRealErrors.push( lines[ i ] ) ;
				}
			}

			if ( jshintRealErrors.length ) {
				term.red( 'KO!' )( '\n' ) ;
				wfm.exitError( "Jshint errors:\n%s\n" , jshintRealErrors.join( '\n' ) ) ;
			}
		}
	}
	catch ( error ) {
		wfm.exitError( "%s\n" , error ) ;
	}

	term.brightGreen( 'OK' )( '\n' ) ;
}



async function eslint( state ) {
	var stdout = '' , stderr = '' ;

	if ( ! state.has.eslint ) { return ; }

	// /!\ Later wfm.json must contains directories to scan /!\
	if ( ! await fsKit.isDirectory( state.cwd + '/lib' ) ) { return ; }

	term.bold.magenta( 'ESLint: ' ) ;

	try {
		var child = spawn( 'eslint "lib/**/*.js" --fix' , { shell: true } ) ;

		child.stdout.on( 'data' , chunk => stdout += chunk ) ;
		//child.stderr.on( 'data' , chunk => stderr += chunk ) ;

		var exit = await Promise.onceEventOrError( child , 'exit' ) ;

		if ( exit ) {
			term.red( 'KO!' )( '\n' ) ;
			wfm.exitError( "ESLint errors:\n%s\n" , stdout ) ;
		}
	}
	catch ( error ) {
		wfm.exitError( "%s\n" , error ) ;
	}

	term.brightGreen( 'OK' )( '\n' ) ;
}



async function unitTest( state ) {
	if ( ! state.package.scripts || ! state.package.scripts.test ) { return ; }

	term.bold.magenta( 'Unit test: %s\n' , state.package.scripts.test.trim().split( ' ' )[ 0 ] ) ;

	// Turn grab input off, so CTRL-C can send SIGINT again
	term.grabInput( false ) ;

	try {
		var child = spawn( state.package.scripts.test , { stdio: [ 0 , 1 , 2 ] , shell: true } ) ;
		var exit = await Promise.onceEventOrError( child , 'exit' ) ;

		if ( exit ) {
			wfm.exitError( "Unit tests failed!\n" ) ;
		}
	}
	catch ( error ) {
		wfm.exitError( "%s\n" , error ) ;
	}

	term.grabInput() ;
}



function packageVersion( state ) {
	if ( state.wfmJson.prepare?.nextVersion ) {
		if ( state.package.version !== state.wfmJson.prepare.nextVersion ) {
			// Should be already done by "wfm prepare", but in case of something went wrong...
			state.package.version = state.wfmJson.prepare.nextVersion ;
			state.writePackage = true ;
		}
		term.bold.magenta( "prepared version: " ).brightYellow( state.package.version )( '\n' ) ;
		return ;
	}

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
}



async function build( state ) {
	if ( ! state.has.makefile || state.makefileRules.indexOf( 'build' ) === - 1 ) { return ; }

	term.bold.magenta( 'building project\n' ) ;

	try {
		await execAsync( 'make build' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



async function buildReadme( state ) {
	if ( ! state.has.makefile || state.makefileRules.indexOf( 'README.md' ) === - 1 ) { return ; }

	term.bold.magenta( 'building README.md\n' ) ;

	try {
		await execAsync( 'make README.md' ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



function writePackage( state ) {
	if ( ! state.writePackage ) { return Promise.resolved ; }
	term.bold.magenta( 'writing package.json\n' ) ;
	return fs.promises.writeFile( state.packagePath , wfm.packagify( state.package ) ) ;
}



async function writeChangelog( state ) {
	var header , content , message ;

	if (
		! state.has.changelog
		|| ( state.wfmJson.prepare && state.wfmJson.prepare.statusType !== 'release' )
	) {
		return ;
	}

	term.bold.magenta( 'writing CHANGELOG\n' ) ;

	if ( state.wfmJson.prepare?.entries?.length ) {
		message = state.wfmJson.prepare.entries.map( entry => entry.type.toUpperCase() + ': ' + entry.message ).join( '\n' ) ;
	}
	else {
		// Rather than one big line, split on semi-colon
		message = state.message.replace( / *; */g , '\n' ) ;
	}

	content = ( await fs.promises.readFile( state.cwd + '/CHANGELOG' ) ).toString() ;

	header = 'v' + state.package.version ;
	header += '\n' + '-'.repeat( header.length ) + '\n\n' ;

	content = '\n' + header + message + '\n\n' + content ;

	await fs.promises.writeFile( state.cwd + '/CHANGELOG' , content ) ;
}



function writeWfmJson( state ) {
	if ( state.wfmJson.prepare && state.wfmJson.prepare.statusType && state.wfmJson.prepare.statusType !== 'release' ) {
		let prepareData = state.wfmJson.prepare ;

		if ( ! prepareData.prereleaseCount ) { prepareData.prereleaseCount = 1 ; }
		else { prepareData.prereleaseCount ++ ; }

		const prepare = require( './prepare.com.js' ) ;
		prepare.buildVersion( state ) ;
	}
	else {
		// If we are releasing, remove all preparation
		state.wfmJson.prepare = {} ;
	}

	return fs.promises.writeFile( state.wfmJsonPath , JSON.stringify( state.wfmJson , null , '\t' ) + '\n' ) ;
}



async function gitAddUntrackedFiles( state ) {
	var commandArgs ;

	if ( ! state.gitUntrackedFiles || ! state.gitUntrackedFiles.length ) { return ; }

	term.bold.magenta( 'git add untracked files\n' ) ;

	commandArgs = state.gitUntrackedFiles.map( string.escape.shellArg ).join( ' ' ) ;

	try {
		await execAsync( 'git add ' + commandArgs ) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



async function gitCommit( state ) {
	var commitMessage = state.message || 'publishing ' + state.releaseType + ' version' ;

	term.bold.magenta( 'git commit\n' ) ;

	try {
		await git.commit( state , commitMessage ) ;
	}
	catch ( error ) {
		// If there is nothing to commit, it's not an error here, just proceed anyway to the publish phase
		if ( error.nothingToCommit ) { return ; }

		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



async function gitTag( state ) {
	term.bold.magenta( 'git tag\n' ) ;

	try {
		await execAsync( 'git tag v' + state.package.version +
			' -a -m v' + state.package.version +
			' -m ' + string.escape.shellArg( state.message || '' )
		) ;
	}
	catch ( error ) {
		wfm.exitError( "Error: %s\n" , error ) ;
	}
}



async function gitPush( state ) {
	var stdout , stderr ;

	if ( state.parallelPublish ) { term( '* ' ) ; }
	term.bold.magenta( 'git push\n' ) ;

	try {
		[ stdout , stderr ] = await execAsync( 'git push --follow-tags' ) ;
	}
	catch ( error ) {
		wfm.exitError( "git push error %s:\n%s\n" , error , stderr ) ;
	}
}



async function npmPublish( state ) {
	var stdout , stderr ;

	if ( state.package.private ) { return ; }

	// Don't publish pre-release on npm
	if ( semver.prerelease( state.package.version ) ) { return ; }

	if ( state.parallelPublish ) { term( '* ' ) ; }
	term.bold.magenta( 'npm publish\n' ) ;

	try {
		[ stdout , stderr ] = await execAsync( 'npm publish' ) ;
	}
	catch ( error ) {
		wfm.exitError( "npm publish error %s:\n%s\n" , error , stderr ) ;
	}
}



function parallelPublish( state ) {
	term.bold.magenta( 'publish in parallele mode:\n' ) ;

	state.parallelPublish = true ;

	return Promise.all( [
		gitPush( state ) ,
		npmPublish( state )
	] ) ;
}



function usage() {
	term( "Usage is: wfm pub[lish] patch|min[or]|maj[or]|again|compat[ible]|break[ing]\n\n" ) ;
	term( "\t--message , -m : specify a message\n" ) ;
	term( '\n' ) ;
}

