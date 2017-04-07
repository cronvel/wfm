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





/* global describe, it */




var wfm = require( '../lib/wfm.js' ) ;






			/* Tests */


describe( "Fake tests" , function() {
	
	it( "fake test #1" , function( done ) {
		setTimeout( done , 100 ) ;
	} ) ;
	
	it( "fake test #2" , function( done ) {
		setTimeout( done , 300 ) ;
	} ) ;
	
	it( "fake test #3" , function( done ) {
		setTimeout( done , 500 ) ;
	} ) ;
	
	it( "fake test #4" , function( done ) {
		setTimeout( done , 300 ) ;
	} ) ;
	
	it( "fake test #5" , function( done ) {
		//throw true ;
		setTimeout( done , 100 ) ;
	} ) ;
} ) ;


