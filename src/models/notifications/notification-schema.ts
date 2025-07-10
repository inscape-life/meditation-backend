import { Schema, model } from 'mongoose';

// const notificationsSchema = new Schema({
//     userIds: {
//         type: [Schema.ObjectId],
//         ref: "company",
//     },
//     title: {
//         type: Object,
//         required: true
//     },
//     description: {
//         type: Object,
//         required: true
//     },
//     read: {
//         type: Boolean,
//         default: false
//     },
//     date: {
//         type: Date,
//         default: Date.now
//     },
// },
//     { timestamps: true }
// )

const notificationsSchema = new Schema({
    userIds: [{
        type: Schema.Types.ObjectId,
        required: true
    }],
    userType: {
        type: String,
        required: true,
        enum: ['admin', 'company']
    },
    title: {
        type: Object,
        required: true
    },
    description: {
        type: Object,
        required: true
    },
    read: {
        type: Boolean,
        default: false
    },
    date: {
        type: Date,
        default: Date.now
    },
}, { timestamps: true });

export const notificationsModel = model('notifications', notificationsSchema)