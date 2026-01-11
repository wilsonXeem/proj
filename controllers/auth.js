// Models
const User = require("../models/user");

/***************
 * User Signup *
 ***************/
module.exports.postSignup = async (req, res, next) => {
  const email = req.body.email,
    password = req.body.password;

  try {
    console.log(email, password);
    // Create new user object
    const user = new User({
      email: email,
      password: password,
    });

    // Save user in database
    const createUser = await user.save();

    // Send response back to client
    res
      .status(201)
      .json({ message: "Sign in successful", type: "user", createUser });
  } catch (err) {
    console.log(err, next);
  }
};

/**************
 *Get all Users*
 ***************/
module.exports.getAllUsers = async (req, res, next) => {
  User.find()
    .exec()
    .then((users) => {
      const response = users.map((user) => {
        return {
          email: user.email,
          password: user.password,
        };
      });
      res.status(200).json(response);
    })
    .catch((error) => next(error));
};
