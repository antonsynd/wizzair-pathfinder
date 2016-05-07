#!/usr/bin/env node

/**
 * Usage:
 * 		node wizzair-pathfinder.js --list
 *		node wizzair-pathfinder.js GDN ABZ
 */

(function () {
	'use strict';

	const argv = require('minimist')(process.argv.slice(2));
	
	const WIZZAIR_URL = 'https://cdn.static.wizzair.com/en-GB/Map.ashx';
	
	const fs = require('fs');
	const request = require('request');
	const cheerio = require('cheerio');
	
	function listDestinations($)
	{
		var cities = $('list > city');
		
		for (let i = 0, imax = cities.length; i < imax; i++)
		{
			var ccity = cities.get(i);
			var cname = $($('name', ccity).get(0)).text();
			var ciata = $($('iata', ccity).get(0)).text();
			
			console.log(cname + ' (' + ciata + ')');
		}
	}
	
	function clone(x)
	{
		return x.slice(0);
	}
	
	function _findPath(map, x, y, path, visited)
	{
		if (map.has(x) && map.has(y))
		{
			// At current point x, check if any of its children
			// are in visited, if at least one is not, then 
			// go on and push paths for that
			var ccity = map.get(x);
			
			var unvisited = [...ccity.connected.keys()].filter(z => !visited.has(z));
			
			if (unvisited.length > 0)
			{
				if (ccity.connected.has(y))
				{
					path.push(x);
					path.push(y);
					return path;
				}
				else
				{
					// No connection, add to visited, add to the current path
					visited.add(x);
					path.push(x);
					
					var validPaths = [];
					
					for (let i of unvisited)
					{
						let res = _findPath(map, i, y, clone(path), visited);
						
						if (res)
						{
							validPaths.push(res);
						}
					}
					
					if (validPaths.length == 0)
					{
						return null;
					}
					else
					{
						validPaths.sort((a, b) => a.length - b.length);
						
						return validPaths[0];
					}
				}
			}
			else
			{
				// Everything has been visited already, dead-end
				visited.add(x);
				return null;
			}
		}
		else
		{
			// Either start or destination is not being served
			return null;
		}
	}
	
	function findRoute($, from, to)
	{
		/**
		 * <city>
		 * 		<name />
		 * 		<iata />
		 * 		<connected>
		 * 			<city>
		 * 				<iata />
		 * 			</city>
		 * 		</connected>
		 * </city>
		 */
		var cities = $('list > city');
		
		var cityMap = new Map();
		
		for (let i = 0, imax = cities.length; i < imax; i++)
		{
			let ccity = cities.get(i);
			let cname = $($('name', ccity).get(0)).text();
			let ciata = $($('iata', ccity).get(0)).text();
			
			let cconnected = new Map();
			
			let cobj = {
				iata: ciata,
				name: cname,
				connected: cconnected,
			};
			
			let connectedCities = $('connected city iata', ccity);
			
			for (let j = 0, jmax = connectedCities.length; j < jmax; j++)
			{
				cconnected.set($(connectedCities.get(j)).text(), null);
			}
			
			cityMap.set(ciata, cobj);
		}
		
		var unserved = [];
		
		// Now update each city's map
		for (let ccity of cityMap.values())
		{
			let cconnected = ccity.connected;
			
			for (let ciata of cconnected.keys())
			{
				if (cityMap.has(ciata))
				{
					cconnected.set(ciata, cityMap.get(ciata));
				}
				else
				{
					unserved.push(ciata);
				}
			}
		}
		
		console.log('The following airports are not being served by Wizz Air at this time:', unserved.join(', '), '\n');
		
		var path = _findPath(cityMap, from, to, [], new Set());
		
		for (let i = 0, imax = path.length; i < imax; i++)
		{
			let ciata = path[i];
			let ccity = cityMap.get(path[i]);
			path[i] = ccity.name + ' (' + ciata + ')';
		}
		
		console.log(path.join(' -> '));
	}
	
	request.get(WIZZAIR_URL, (error, response, body) => {
		if (!error && response.statusCode == 200)
		{
			var utf8 = {
				encoding: 'utf-8',
			};
			
			var opts = {
				xmlMode: true,
				decodeEntities: false,
			};
			
			const $ = cheerio.load(body, opts);
			
			switch (argv._.length)
			{
				case 0:
				{
					listDestinations($);
				}
					break;
				case 1:
				{
					if (argv._[0] === '--list')
					{
						listDestinations($);
					}
					else
					{
						console.error('If one argument, expecting "--list"');
						return;
					}
				}
					break;
				case 2:
				{
					findRoute($, argv._[0], argv._[1]);
				}
					break;
				default:
				{
					console.error('Expecting "--list" or two IATA codes');
					return;
				}
					break;
			}
		}
	});
})();