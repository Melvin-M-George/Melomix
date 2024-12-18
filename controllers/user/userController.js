const User = require("../../models/userSchema")
const Category = require("../../models/categorySchema");
const Product = require("../../models/ProductSchema");
const Cart = require("../../models/cartSchema");
const Wishlist = require("../../models/wishlistSchema");
const nodemailer = require("nodemailer")
const env = require("dotenv").config();
const bcrypt = require('bcrypt');

const loadHomepage = async (req, res) => {
    try {
        const user = req.session.user;
        
        const  categories = await Category.find({isListed:true});

        const selectedCategory = req.query.category;

        let productQuery = { isBlocked: false };
        if (selectedCategory) {
            productQuery.category = selectedCategory; 
        } else {
            productQuery.category = { $in: categories.map(category => category._id) };
        }

        let productData = await Product.find(productQuery);
        
        let totalProductCount = await Product.countDocuments();
        let disaplayProducts = totalProductCount - 4;

        productData.sort((a,b)=>new Date(b.createdOn)-new Date(a.createdOn));
        productData = productData.slice(disaplayProducts);



        if (user) {
            const userData = await User.findOne({ _id: user._id });
            return res.render("home", { user: userData ,products:productData,categories, selectedCategory});
        } else {
            return res.render("home", {products:productData , categories, selectedCategory}); 
        }
    } catch (error) {
        console.log("Home page not found");
        return res.status(500).send("Server error");
    }
};


const pageNotFound = async (req,res)=>{
    try {
        res.render("page-404")
    } catch (error) {
        res.redirect("/pageNotFound")
    }
}

const loadSignup = async (req,res) => {
    try {
        return res.render("signup");
    } catch (error) {
        console.log("Sign up page is not loading: ",error);
        res.status(500).send("Server error")
    }
}

function generateOtp(){
    return Math.floor(100000 + Math.random()*900000).toString();
}
async function sendVerificationEmail(email,otp){
    try {
        const transporter = nodemailer.createTransport({
            service:"gmail",
            port:587,
            secure:false,
            requireTLS:true,
            auth:{
                user:process.env.NODEMAILER_EMAIL,
                pass:process.env.NODEMAILER_PASSWORD
            }
        })

        const info = await transporter.sendMail({
            from:process.env.NODEMAILER_EMAIL,
            to:email,
            subject:"Verify your account",
            text:`Your OTP is ${otp}`,
            html:`<b>Your OTP: ${otp}<b>`
        })

        return info.accepted.length > 0

    } catch (error) {
        console.error("Error sending email",error);
        return false;
    }
}

const signup = async (req,res) => {
    try {
        const {name,phone,email,password,cPassword} = req.body;
        if(password !== cPassword){
            return res.render("signup",{message:"Password do no match"})
        }
        const findUser = await User.findOne({email})
        if(findUser){
            return res.render("signup",{message:"User with this email already exists"});
        }

        const otp = generateOtp();

        const emailSent = await sendVerificationEmail(email,otp); 
        if(!emailSent){
            return res.json("email-error")
        }
        req.session.userOtp = otp;
        req.session.userData = {name,phone,email,password};

        res.render("verify-otp",{message:""});
        console.log("OTP Sent",otp);

    } catch (error) {
        console.error("signup error",error);
        res.redirect("/pageNotFound");
    }
}

const securePassword = async (password)=>{
    try {
        const passwordHash = await bcrypt.hash(password,10);
        return passwordHash;

    } catch (error) {
        
    }
}
const verifyOtp = async (req,res) => {
    try {
        const {otp,googleId} = req.body;
        if(otp === req.session.userOtp){
            const user = req.session.userData;
            const passwordHash = await securePassword(user.password);

            const saveUserData = new User({
                name:user.name,
                email:user.email,
                phone:user.phone,
                password:passwordHash,
                ...(googleId && { googleId }),
            })

            await saveUserData.save();
            req.session.user = saveUserData._id;
            return res.json({success:true,redirectUrl:"/login"})
        }else{
            return res.status(400).json({success:false,message:"Invalid OTP, Please try again"})
        }
    } catch (error) {
        console.error("Error Verfiying OTP",error);
        return res.status(500).json({success:false,message:"An error occured"});
    }
}

const resendOtp = async (req,res) => {
    try {
        
        const {email} = req.session.userData;
        if(!email){
            return res.status(400).json({success:false,message:"Email not found in session"})
        }
        const otp = generateOtp();
        req.session.userOtp = otp;

        const emailSent = await sendVerificationEmail(email,otp);
        if(emailSent){
            console.log("Resend OTP:",otp);
            res.status(200).json({success:true,message:"OTP Resend Successfully"})
        }else{
            res.status(500).json({success:false,message:"Failed to resend OTP. Please try again"})
        }

    } catch (error) {
        console.error("Error resending OTP",error);
        res.status(500).json({success:false,message:"Internal server error. Please try again"});
    }
}

const loadLogin = async (req, res) => {
    try {
  
      // const message = req.query.msg || ""
  
      if (req.session.user) {
        const user = await User.findById(req.session.user._id);
        if (user && user.isBlocked) {
          req.session.user = null;
          return res.render("login", { message: "User is blocked" });
        }
        return res.redirect("/");
      } else {
        return res.render("login", { message: '' });
      }
  
    } catch (error) {
      res.redirect('/page-not-found')
    }
  };


const login = async (req,res)=>{
    try {
        const {email,password} = req.body;
        const findUser = await User.findOne({isAdmin:0,email:email});
        if(!findUser){
            return res.render("login",{message:"User not found"});
        }
        if(findUser.isBlocked){
            return res.render("login",{message:"User is blocked by admin"})
        }

        const passwordMatch = await bcrypt.compare(password,findUser.password);
        if(!passwordMatch){
            return res.render("login",{message:"Incorrect Password"})
        }

        req.session.user = findUser;
        res.redirect("/");
    } catch (error) {
        console.error("login error",error);
        res.render("login",{message:"Login failed. Please try again."})
    }
}


const logout = async (req,res)=>{
    try {
        req.session.destroy((err)=>{
            if(err){
                console.log("Session destruction error",err.message)
                return res.redirect("/PageNotFound")
            }
            return res.redirect("/login")
        })
    } catch (error) {
        console.log("Logout error",error);
        res.redirect("/PageNotFound");  
    }
}

const getProductDetails = async (req,res) => {
    try {
        const id = req.query.id;
        const userId = req.session.user;

        const productData = await Product.findById(id).populate('category');
        
        const relatedProducts = await Product.find({category:productData.category._id});
        const userData = await User.findById(userId);
        if(productData){
            return res.render("productDetails",{data:productData,user:userData,products:relatedProducts})
        }

        

    } catch (error) {
        console.log("Error loading Product details page",error);
    }
}

const sortAndFilterProducts = async (req, res) => {
    try {
        const { sort = 'default', category = '', search = '' } = req.query;
        const page = parseInt(req.query.page) || 1;
        const limit = 8;
        const skip = (page - 1) * limit;

        // Determine sort criteria
        let sortCriteria;
        switch (sort) {
            case 'popularity':
                sortCriteria = { popularity: -1 };
                break;
            case 'price-low-high':
                sortCriteria = { salePrice: 1 };
                break;
            case 'price-high-low':
                sortCriteria = { salePrice: -1 };
                break;
            case 'rating':
                sortCriteria = { rating: -1 };
                break;
            case 'new-arrivals':
                sortCriteria = { createdAt: -1 };
                break;
            case 'alphabetical-a-z':
                sortCriteria = { productName: 1 };
                break;
            case 'alphabetical-z-a':
                sortCriteria = { productName: -1 };
                break;
            default:
                sortCriteria = { createdAt: 1 };

        }

       
        const filterConditions = { isBlocked: false, status: "Available" };

        if (category) {
            filterConditions.category = category;
        }

        if (search) {
            filterConditions.productName = { $regex: search, $options: 'i' };
        }

        
        const filteredCount = await Product.countDocuments(filterConditions);
        const totalPages = Math.ceil(filteredCount / limit);

       
        const products = await Product.find(filterConditions)
            .sort(sortCriteria)
            .skip(skip)
            .limit(limit)
            .populate('category', 'name');

        res.json({ products, totalPages, currentPage: page });
    } catch (error) {
        console.error('Error fetching filtered and sorted products:', error);
        res.status(500).json({ message: 'An error occurred while fetching products.' });
    }
};


  const headerBadgeCount = async (req,res) => {
    try {
        const userId = req.session.user;
        let cartlen = 0;
        let wishlistlen = 0;

        if (userId) {
            const cart = await Cart.findOne({ userId });
            const wishlist = await Wishlist.findOne({ userId });

            if (wishlist && wishlist.products) {
                wishlistlen = wishlist.products.length;
            }
            if (cart && cart.items) {
                cartlen = cart.items.length;
            }
        }

        res.json({ success: true, cartlen, wishlistlen });
    } catch (error) {
        console.error("Error fetching counts:", error);
        res.json({ success: false, message: "Failed to fetch counts" });
    }
  }




module.exports = {
    loadHomepage,
    pageNotFound,
    loadSignup,
    loadLogin,
    signup,
    verifyOtp,
    resendOtp,
    login,
    logout,
    getProductDetails,
    sortAndFilterProducts,
    headerBadgeCount,
    


    
}