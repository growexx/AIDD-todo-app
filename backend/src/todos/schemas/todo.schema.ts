import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type TodoDocument = Todo & Document;

@Schema({ timestamps: true })
export class Todo {
  @Prop({ required: true, trim: true, minlength: 1, maxlength: 200 })
  title: string;

  @Prop({ trim: true, maxlength: 1000, default: '' })
  description: string;

  @Prop({ default: false })
  completed: boolean;

  @Prop({ enum: ['low', 'medium', 'high'], default: 'medium' })
  priority: string;

  @Prop({
    type: Date,
    validate: {
      validator: function (v: Date | undefined) {
        if (v == null || v === undefined) return true;
        const todayMidnight = new Date();
        todayMidnight.setHours(0, 0, 0, 0);
        return v >= todayMidnight;
      },
      message: 'Due date cannot be in the past',
    },
  })
  dueDate?: Date;

  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  user: Types.ObjectId;
}

export const TodoSchema = SchemaFactory.createForClass(Todo);
TodoSchema.index({ user: 1, createdAt: -1 });
