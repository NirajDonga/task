import mongoose from 'mongoose';

const JobSchema = new mongoose.Schema({
    userId: { 
        type: mongoose.Schema.Types.ObjectId, 
        ref: 'User', 
        required: true 
    },
    originalName: {
        type: String, 
        required: true 
    },
    filePath: { 
        type: String, 
        required: true 
    },
    mimeType: { 
        type: String, 
        required: true 
    },
    thumbnailUrl: { 
        type: String 
    }, 
    status: { 
        type: String, 
        enum: ['queued', 'processing', 'completed', 'failed'], 
        default: 'queued' 
    },
    createdAt: { type: Date, default: Date.now }
});

export const Job = mongoose.model('Job', JobSchema);