import { Injectable } from '@nestjs/common';
import { envs } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';

@Injectable()
export class PaymentsService {

  private readonly stripe = new Stripe(envs.stripeSecret)

  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items.map(item => {
      return {
        price_data: {
          currency,
          product_data: {
            name: item.name,
          },
          unit_amount: Math.round(item.price * 100),
        },
        quantity: item.quantity,
      }
    });

    const session = await this.stripe.checkout.sessions.create({
      //aqui va el id de la orden
      payment_intent_data: {
        metadata: {
          orderId: orderId,
        }
      },
      line_items: lineItems,
      mode: 'payment',
      success_url: 'http://localhost:3003/payments/success',
      cancel_url: 'http://localhost:3003/payments/cancel',
    });

    return session;
  }

  async stripeWebhook(request: Request, res: Response) {
    const sig = request.headers['stripe-signature'];

    let event: Stripe.Event;
    //Testing
    // const endpointSecret = "whsec_8c8529cbf196dd077df7c1a4e9100345ba7285b52a5befb7aa1dbf9ff8d868be";

    //real
    const endpointSecret = "whsec_j48ojcCEm6IbiOIvwcWiT4i6qIt1uz3v";

    try {
      event = this.stripe.webhooks.constructEvent(request['rawBody'], sig, endpointSecret);
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object
        //TODO: Llamar microservicio
        console.log({
          metadata: chargeSucceeded.metadata,
          orderId: chargeSucceeded.metadata.orderId,
        });
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);

    }

    return res.status(200).json({ sig });
  }
}
