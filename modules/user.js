let mongoose = require('mongoose'),
	db = mongoose.connection.useDb('mad_quotes');

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
	categories: {
		type: [String],
		default: [],
		lowercase: true,
	},
	likes: {
		type: Number,
		default: 0,
	},
});

let quoteModel = db.model('quote', quoteSchema);

class MadQuoteUserError extends Error {
	constructor(message, cause = 'Unknown cause') {
		super(message);
		this.cause = cause;
		this.message = message;
	}
}

class User {
	constructor(id) {
		this.id = id;
	}

	// Save the user to database
	// Accepts the http response object as a parameter
	static async save(req, res, next) {
		let { email, name, password } = req.body;
		try {
			let userExists = await User.#userExists(email);
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
			let userExists = await User.#userExists(email);
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
	static async #userExists(email) {
		try {
			let user = await userModel.findOne({ email });
			if (!user) return false;
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}
	async userExists() {
		try {
			let user = await userModel.find({ _id: this.id });
			if (user) return user._doc;
			throw new MadQuoteUserError(
				`No user was found with the ID - ${this.id}`,
				'User not found'
			);
		} catch (error) {
			console.error(error);
			throw new MadQuoteUserError(error.message);
		}
	}
	// Gets user's own quotes
	async getQuotes(limit = 10, page = 1) {
		try {
			await this.userExists();
			return await quoteModel
				.find({
					authorId: this.id,
				})
				.skip(page <= 1 ? 0 : limit * (page - 1))
				.limit(limit);
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	// Get user's info
	async info() {
		try {
			await this.userExists();
			return await userModel.findOne({ _id: this.id });
		} catch (error) {
			console.error(error);
			return null;
		}
	}

	// Upload new quote
	async uploadQuote(quote, categories) {
		try {
			let { name, _id } = await this.info();
			await quoteModel.create({
				author: name,
				authorId: _id,
				content: quote,
				categories:
					Array.isArray(categories) && categories.length > 0
						? categories
						: undefined,
			});
			return true;
		} catch (error) {
			console.error(error);
			return false;
		}
	}

	// Get user favorite quotes
	async favorites(limit = 10, page = 1) {
		try {
			let user = await this.info();
			let favorites = [];
			for (let id of user.favoriteQuotes) {
				let quote = await quoteModel.findOne({ _id: id });
				if (quote) favorites.push(quote);
			}
			return favorites;
		} catch (error) {
			console.error(error);
			return null;
		}
	}
}

module.exports = User;
