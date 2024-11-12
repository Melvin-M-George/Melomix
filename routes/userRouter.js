const express = require('express');
const router = express.Router();
const passport = require('passport');
const userController = require("../controllers/user/userController");
const profileController = require("../controllers/user/profileController"); 


//Error management
router.get("/pageNotFound",userController.pageNotFound)

//sign up
router.get("/signup",userController.loadSignup);
router.post("/signup",userController.signup);
router.post("/verify-otp",userController.verifyOtp);
router.post("/resend-otp",userController.resendOtp);
router.get("/auth/google",passport.authenticate("google",{scope:["profile","email"]}));
router.get("/google/callback",passport.authenticate("google",{failureRedirect:"/signup"}),(req,res)=>{res.redirect("/")});

//Login
router.get("/login",userController.loadLogin);
router.post("/login",userController.login);

//Home page and Logout
router.get("/",userController.loadHomepage);
router.get("/logout",userController.logout);
router.get("/productDetails",userController.getProductDetails);

//Profile management
router.get("/forgot-password",profileController.getForgotPassPage);
router.post("/forgot-email-valid",profileController.forgotEmailValid);
router.post("/verify-passForgot-otp",profileController.verifyForgotPassOtp);
router.get("/reset-password",profileController.getResetPassPage);
router.post("/resend-forgot-otp",profileController.resendOtp);


module.exports = router;