import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PermissionDocument = Permission & Document;

const PERMISSION_CODE_REGEX =
  /^(\*:\*|[a-z][a-z0-9_-]*:\*|[a-z][a-z0-9_-]*:[a-z][a-z0-9_-]*)$/;

/**
 * Permission schema: code (module:action or wildcard) and optional description.
 */
@Schema({ timestamps: true, toJSON: { virtuals: true }, toObject: { virtuals: true } })
export class Permission {
  @Prop({ required: true, unique: true, trim: true, match: PERMISSION_CODE_REGEX })
  code: string;

  @Prop({ trim: true, default: '' })
  description: string;
}

export const PermissionSchema = SchemaFactory.createForClass(Permission);
// code unique index is created by @Prop({ unique: true })
