const express = require('express');
const mongoose = require('mongoose');
const app = express();
const { readFile } = require('fs/promises');
const User = require('./modules/user');
const cookieParser = require('cookie-parser');
const PORT = process.env.PORT || 5500;
require('dotenv').config();

mongoose
	.connect(
		process.env.MONGOOSE_CONNECTION_STRING || 'mongodb://localhost:27017'
	)
	.then(() => {
		app.use(cookieParser());
		app.use(express.urlencoded({ extended: true }));
		app.use(express.json());
		app.use(express.static('./public'));
		// Function to authorize users in the api route
		async function authorize(req, res, next) {
			let { auth_token } = req.cookies;
			try {
				let user = await new User(decodeURIComponent(auth_token)).userExists();
				req.userId = decodeURIComponent(auth_token);
				next();
			} catch (error) {
				// Send an empty array because of issues on the frontend concerning invalid json
				res.status(401).json([]);
				console.error(error);
			}
		}
		// Authorization function for dashboard
		async function authorizeDashboard(req, res, next) {
			let { auth_token } = req.cookies;
			try {
				let user = await new User(decodeURIComponent(auth_token)).userExists();
				req.userId = decodeURIComponent(auth_token);
				next();
			} catch (error) {
				// Send an empty array because of issues on the frontend concerning invalid json
				res.redirect(307, '/login');
				console.error(error);
			}
		}
		app.get('/login', async (req, res, next) => {
			const file = await readFile('./public/login.html', { encoding: 'utf-8' });
			res.setHeader('Content-Type', 'text/html');
			res.send(file);
		});
		app.get('/register', async (req, res, next) => {
			const file = await readFile('./public/register.html', {
				encoding: 'utf-8',
			});
			res.setHeader('Content-Type', 'text/html');
			res.send(file);
		});

		// User dashboard
		app.get('/dashboard', authorizeDashboard, async (req, res, next) => {
			let file = await readFile('./public/dashboard.html', {
				encoding: 'utf-8',
			});
			let info = await new User(req.userId).info();
			if (!info) return res.redirect(307, '/login');
			file = file.replace(/<%USER NAME%>/, info.name);
			file = file.replace(/<%USER EMAIL%>/, info.email);
			file = file.replace(/<%USER ID%>/, info._id);
			res.setHeader('Content-Type', 'text/html');
			res.send(file);
		});

		// Quote creation page
		app.get('/dashboard/create', authorizeDashboard, async (req, res, next) => {
			const file = await readFile('./public/create_quote.html', {
				encoding: 'utf-8',
			});
			res.setHeader('Content-Type', 'text/html');
			res.send(file);
		});

		/**
		 * API routes go here
		 */

		// User registration route
		app.post('/api/register', User.save);

		// User login route
		app.post('/api/login', User.login);

		// Get user quotes
		app.get('/api/user/quotes', authorize, async (req, res, next) => {
			let { page, limit } = req.query;
			let quotes = await new User(req.userId).getQuotes(limit, page);
			if (!quotes) res.json([]);
			res.json([...quotes]);
		});

		// Upload user quote
		app.post('/api/user/upload', authorize, async (req, res, next) => {
			try {
				let { body, categories } = req.body,
					didUpload = await new User(req.userId).uploadQuote(body, categories);
				if (didUpload) return res.status(201).send('');
				else res.status(503).send('');
			} catch (error) {
				res.status(500).send('Internal server error!');
				console.error(error);
			}
		});

		// Get user favorite quotes
		app.get('/api/user/favorites', authorize, async (req, res, next) => {
			try {
				let { page, limit } = req.query;
				let favorites = await new User(req.userId).favorites(limit, page);
				if (!favorites) return res.status(503).json([]);
				res.json([...favorites]);
			} catch (error) {
				res.status(500).send('Internal server error!');
				console.error(error);
			}
		});

		app.listen(PORT, () => {
			console.log(`Express application running on port: ${PORT}`);
		});
	})
	.catch((err) => console.error(err));
