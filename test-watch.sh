#!/bin/bash


PATH=./node_modules/coffee-script/bin:$PATH

node_modules/jasmine-node/bin/jasmine-node --color --autotest .
