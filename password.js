const bcrypt = require("bcrypt");

const password = ";  // Your desired password
const saltRounds = 10;

bcrypt.hash(password, saltRounds, (err, hash) => {
    if (err) {
        console.error("Error hashing password:", err);
    } else {
        console.log("Hashed Password:", hash);
    }
});
