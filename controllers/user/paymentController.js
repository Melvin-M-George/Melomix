const Razorpay = require("razorpay");
const Order = require("../../models/orderSchema");
const crypto = require('crypto');
require("dotenv").config();


const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
})

const createRazorpay = async (req, res) => {
    try {
        const { amount, discount } = req.body;
        const amt = Number(discount ? Math.max(amount, 0) : amount);
        const options = {
            amount: amt * 100,
            currency: "INR",
            receipt: `receipt_${Date.now()}`,
        };

        const order = await razorpay.orders.create(options);
        res.status(200).json({ success: true, order });
    } catch (error) {
        console.error("Error creating Razorpay order", error);
        res.status(500).json({ success: false, message: "Failed to create razorpay order" }, error);
    }
}

const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.query;
        console.log(orderId);
        if (!orderId) {
            return res.status(400).json({ message: "Order ID is required" });
        }

        const order = await Order.findById(orderId)
            .populate('orderedItems.product')
            .populate('address');

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        const options = {
            amount: Math.round(order.finalAmount * 100),
            currency: 'INR',
            receipt: `retry_order_rcptid_${Date.now()}`
        };

        const razorpayOrder = await razorpay.orders.create(options);

        return res.status(200).json({
            razorpay: {
                amount: razorpayOrder.amount,
                currency: razorpayOrder.currency,
                razorpayOrderId: razorpayOrder.id
            },
            orderDetails: {
                orderId: order.orderId, // Use `orderId` instead of `_id`
                user: order.user,
                orderedItems: order.orderedItems,
                totalPrice: order.totalPrice,
                discount: order.discount,
                finalAmount: order.finalAmount,
                address: order.address,
                status: order.status,
                paymentStatus: order.paymentStatus,
                paymentMethod: order.paymentMethod,
                createdOn: order.createdOn
            }
        });
    } catch (error) {
        console.error("Error during retry payment:", error);
        return res.status(500).json({ message: "Failed to initiate retry payment", error: error.message });
    }
};

const updateOrder = async (req, res) => {
    try {
        const { orderId, paymentId, razorpayOrderId, signature, status } = req.body;



        const body = `${razorpayOrderId}|${paymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body.toString())
            .digest('hex');

        if (expectedSignature === signature) {
            const updatedOrderData = await Order.findOneAndUpdate(
                { _id: orderId },
                { paymentStatus: "Completed", status: "Processing" },
                { new: true }
            );

            if (updatedOrderData) {
                return res.status(200).json({ message: 'Payment verified and order updated', updatedOrderData });
            } else {
                return res.status(404).json({ message: 'Order not found' });
            }
        } else {

            console.log("Updating order to Payment Failed...");
            const updatedOrderData = await Order.findOneAndUpdate(
                { _id: orderId },
                { paymentStatus: "Pending", status: "Pending" },
                { new: true }
            );

            if (updatedOrderData) {
                return res.status(200).json({ message: 'Order marked as Pending', updatedOrderData });
            } else {
                return res.status(404).json({ message: 'Order not found' });
            }
        }
    } catch (error) {
        console.error("Error updating order:", error);
        return res.status(500).json({ message: 'Order update failed', error });
    }
};



module.exports = {
    createRazorpay,
    retryPayment,
    updateOrder,

}