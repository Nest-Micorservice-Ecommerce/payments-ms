import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsInt, IsNumber, IsPositive, IsString, MinLength, ValidateNested } from "class-validator";


export class PaymentSessionDto {

  @IsString()
  orderId: string;

  @IsString()
  currency: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(()=>PaymentSessionItemDto)
  items: PaymentSessionItemDto[];
}


export class PaymentSessionItemDto {
  @IsString()
  @MinLength(1)
  name: string

  @IsNumber()
  @IsPositive()
  @IsInt()
  quantity: number

  @IsNumber()
  @IsPositive()
  price: number

}
