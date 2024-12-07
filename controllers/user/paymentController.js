const Razorpay = require("razorpay");
require("dotenv").config();


const razorpay = new Razorpay({
    key_id:process.env.RAZORPAY_KEY_ID,
    key_secret:process.env.RAZORPAY_KEY_SECRET
})

const createRazorpay = async (req,res) => {
    try {
        const {amount,discount} = req.body;
        const amt = Number( discount ? Math.max(amount - discount, 0) : amount);
        const options = {
            amount:amt * 100,
            currency:"INR",
            receipt:`receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({success:true,order});
    } catch (error) {
        console.error("Error creating Razorpay order",error);
        res.status(500).json({success:false, message:"Failed to create razorpay order"},error);
    }
}


module.exports = {
    createRazorpay,
}