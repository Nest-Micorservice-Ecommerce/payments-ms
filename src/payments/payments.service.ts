import { Inject, Injectable, Logger } from '@nestjs/common';
import { envs, NATS_SERVICE } from 'src/config';
import Stripe from 'stripe';
import { PaymentSessionDto } from './dto/payment-session.dto';
import { Request, Response } from 'express';
import { receiveMessageOnPort } from 'worker_threads';
import { ClientProxy } from '@nestjs/microservices';

@Injectable()
export class PaymentsService {

  private readonly stripe = new Stripe(envs.stripeSecret)
  private readonly logger = new Logger('PaymentsService');

  constructor(
    @Inject(NATS_SERVICE)
    private readonly client: ClientProxy,
  ) { }


  async createPaymentSession(paymentSessionDto: PaymentSessionDto) {

    const { currency, items, orderId } = paymentSessionDto;

    const lineItems = items!.map(item => {
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
      success_url: envs.stripeSuccessUrl,
      cancel_url: envs.stripeCancelUrl,
    });

    // return session;    esta linea retorna toda la sesion la cual tiene mucha info innecesaria
    return {
      cancelUrl: session.cancel_url,
      successUrl: session.success_url,
      url: session.url,
    }
  }

  async stripeWebhook(request: Request, res: Response) {
    const sig = request.headers['stripe-signature'];

    let event: Stripe.Event;
    //real
    const endpointSecret = envs.stripeEndpointSecret;

    try {
      event = this.stripe.webhooks.constructEvent(request['rawBody'], sig, endpointSecret);
    } catch (error) {
      res.status(400).send(`Webhook Error: ${error.message}`);
      return;
    }

    switch (event.type) {
      case 'charge.succeeded':
        const chargeSucceeded = event.data.object
        const payload = {
          stripePaymentId: chargeSucceeded.id,
          orderId: chargeSucceeded.metadata.orderId,
          receipUrl: chargeSucceeded.receipt_url
        }
        // this.logger.log({ payload })
        this.client.emit('payment_succeeded', payload)
        break;

      default:
        console.log(`Unhandled event type ${event.type}`);

    }

    return res.status(200).json({ sig });
  }
}
