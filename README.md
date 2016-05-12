node-red-contrib-marantz-http
==========================
# Description

Control your Marantz AVR devices over IP, by HTTP request from Node-RED.

# What's inside?

It will include three nodes:

'marantz-http-controller' : a unique CONFIG node that holds connection configuration for marantz-http and will acts as the encapsulator for marantz-http access. As a node-red 'config' node, it cannot be added to a graph, but it acts as a singleton object that gets created in the the background when you add an 'marantz-http-out' or 'marantz-http-in' node and configure it accordingly.

-- 'marantz-http-out' : marantz-http output node that can send marantz commands, so it can be used with function blocks.

-- 'marantz-http-in': marantz-http listener node, who emits flow messages based on activity on the marantz-http device.

-- payload contains:

--- string data - REQUIRED

# Install

Run command on Node-RED installation directory
	npm install node-red-contrib-marantz-http

# Usage

![Image alt] (icons/example.png)
 
# License

![Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)](https://licensebuttons.net/l/by-nc-sa/4.0/88x31.png "CC BY-NC-SA 4.0")

#TODO

- Implement autodiscovery of Marantz devices.
- Implement `marantz-http-in` node