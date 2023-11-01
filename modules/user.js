let mongoose = require('mongoose'),
	db = mongoose.connection.useDb('Naija_Quotes');

// User schema for saving users on database
let userSchema = new mongoose.Schema({
	name: {
		type: String,
		required: [true, "The user's name is required"],
	},
	email: {
		type: String,
		required: [true, "The user's email is required"],
	},
	password: {
		type: String,
		required: [true, "The user's password is required"],
	},
	favoriteQuotes: {
		type: [String],
		default: [],
	},
});
let userModel = db.model('user', userSchema);

// Quote schema for saving user quotes on a database
let quoteSchema = new mongoose.Schema({
	author: {
		type: String,
		required: [true, "Quote's author is required"],
	},
	authorId: {
		type: String,
		required: [true, "Quote's author ID is required"],
	},
	content: {
		type: String,
		required: [true, "Quote's content is required"],
	},
	dataCreated: {
		type: Date,
		default: new Date().getTime(),
	},
	likes: {
		type: Number,
		default: 0,
	},
});

let quoteModel = db.model('quote', quoteSchema);

let categorySchema = new mongoose.Schema({
	name: String,
	members: {
		type: [String],
		default: [],
	},
});

let categoryModel = db.model('category', categorySchema);

class User {
	constructor(id) {
		this.id = id;
	}

	// Save the user to database
	// Accepts the http response object as a parameter
	static async save(req, res, next) {
		let { email, name, password } = req.body;
		try {
			let userExists = await User.#exists(email);
			if (userExists)
				return res.status(409).json({
					success: false,
					message: 'An account already exists with this email address',
				});
			let newUser = await userModel.create({
				name,
				email,
				password,
			});
			res.cookie('auth_token', newUser._id, {
				maxAge: 3600000 * 3, // 3 hours
				secure: true,
			});
			res.status(201).json({ success: true });
		} catch (error) {
			res.json({ success: false, message: 'Internal server error' });
			console.error(error);
		}
	}

	// Save the user to database
	// Accepts the http response object as a parameter
	static async login(req, res, next) {
		let { email, password } = req.body;
		try {
			let userExists = await User.#exists(email);
			if (!userExists)
				return res.status(404).json({
					success: false,
					message: 'You do not have an account yet. Login to create one.',
				});
			let user = await userModel.findOne({ email });
			if (password !== user._doc.password)
				return res.status(401).json({
					success: false,
					message: 'The password you provided is incorrect',
				});
			res.cookie('auth_token', user._id, {
				maxAge: 3600000 * 3, // 3 hours
				secure: true,
			});
			res.json({ success: true });
		} catch (error) {
			res.json({ success: false, message: 'Internal server error' });
			console.error(error);
		}
	}

	// Checks if a user with the specified email exists
	static async #exists(email) {
		try {
			let user = await userModel.findOne({ email });
			if (!user) return false;
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
	async exists() {
		try {
			let user = await userModel.findOne({ _id: this.id });
			if (!user) return false;
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
	// Gets user's own quotes
	async quotes(limit = 10, page = 1) {
		try {
			if (await this.exists()) {
				return await quoteModel
					.find({
						authorId: this.id,
					})
					.skip(limit * (page - 1))
					.limit(limit);
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	// Get user's info
	async info() {
		try {
			if (await this.exists()) {
				return await userModel.findOne({ _id: this.id });
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	// Upload new quote
	async upload(quote, categories) {
		try {
			if (await this.exists()) {
				let { name, _id } = await this.info();
				let newQuote = await quoteModel.create({
					author: name,
					authorId: _id,
					content: quote,
				});
				let categoriesArr = categories.split(',');
				for (let name of categoriesArr) {
					let currentCategory = await categoryModel.findOne({
						name: name.trim(),
					});
					if (!currentCategory) continue;
					await categoryModel.findOneAndUpdate(
						{ name },
						{
							members: [...currentCategory._doc.members, newQuote._id],
						}
					);
				}
				return true;
			}
			return false;
		} catch (error) {
			console.error(error);
			return false;
		}
	}

	// Get user favorite quotes
	async favorites(limit = 10, page = 1) {
		try {
			if (await this.exists()) {
				let { favoriteQuotes } = await this.info();
				return await quoteModel
					.find()
					.where('_id')
					.in(favoriteQuotes)
					.skip(limit * (page - 1))
					.limit(limit);
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	// Get  user feed
	async feed(preferences = 'nigeria', limit = 10, page = 0) {
		try {
			if (await this.exists()) {
				preferences = preferences.split(',');
				console.log(preferences);
				let categories = await categoryModel
					.find({})
					.where('name')
					.in(preferences)
					.skip(limit * (page - 1))
					.limit(limit);
				let feed = [];
				for (let category of categories) {
					let quotes = await quoteModel
						.find()
						.where('_id')
						.in(category.members)
						.nor([{ authorId: this.id }])
						.skip(limit * (page - 1))
						.limit(limit);
					feed = [...feed, ...quotes];
				}
				return feed;
			}
			return null;
		} catch (error) {
			console.error(error);
			return null;
		}
	}
}

module.exports = User;
