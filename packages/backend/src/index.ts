import express from 'express';
import cors from 'cors';
import paymentRoutes from './routes/paymentRoutes';

const app = express();
const PORT = process.env.PORT || 8080;

// BigInt JSON Patch
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

app.use(cors());
app.use(express.json());

// Health Check for Google Cloud Load Balancer
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.use('/api/v1/handshake', paymentRoutes);

app.listen(PORT, () => {
  console.log(`Securerise Trust API Live on Port ${PORT}`);
});
