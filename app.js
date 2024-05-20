const path = require('path');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const cors = require('cors');
const bodyParser = require('body-parser');

const AppError = require('./utils/appError');
const globalErrorHandler = require('./controller/errorController');

const toursRouter = require('./router/tourRoutes');
const usersRouter = require('./router/userRoutes');
const reviewRouter = require('./router/reviewRoutes');
const bookingRouter = require('./router/bookingRoutes');
const viewRouter = require('./router/viewRoutes');

const bookingController = require('./controller/bookingController');

const app = express();
app.enable('trust proxy');

// Determine if the app is running behind a proxy
const isBehindProxy = process.env.NODE_ENV === 'production';

// Configure trust proxy based on the environment
app.set('trust proxy', isBehindProxy ? 1 : false);

app.set('view engine', 'pug');
app.set('views', path.join(__dirname, 'views'));

// GLOBAL MIDDLEWARES
app.use(cors());
// Access-Control-Allow-Origin

app.options('*', cors());

// Serving static files
app.use(express.static(path.join(__dirname, 'public')));

//  Set security HTTp headers
app.use(helmet());

// console.log(process.env.NODE_ENV);

// Development logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Limit requests from same API
// const limiter = rateLimit({
//   max: 100,
//   windowMs: 60 * 60 * 1000,
//   message: 'Too many requests from this IP, please try again in an hour!',
// });

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  handler: (req, res) => {
    res.status(429).send('Too many requests, please try again later.');
  },
  trustProxy: isBehindProxy, // Ensure this is set correctly
});

app.use('/api', limiter);

// Stripe Webhook
app.post(
  '/webhook-checkout',
  bodyParser.raw({
    type: 'application/json',
  }),
  bookingController.webhookCheckout
);

// Body parser, reading data from  body into req.body
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());

// Data sanitization against NoSQL
app.use(mongoSanitize());
// Data sanitization against XSS
app.use(xss());

// Prevent parameter pollution
app.use(
  hpp({
    whitelist: [
      'duration',
      'ratingsQuantity',
      'ratingsAverage',
      'maxGroupSize',
      'difficulty',
      'price',
    ],
  })
);

app.use(compression());

// Test middleware
// app.use((req, res, next) => {
//   console.log('Hello from the middleware');
//   next();
// });
app.use((req, res, next) => {
  req.requestTime = new Date().toISOString();

  next();
});

// ROUTES

app.use('/', viewRouter);
app.use('/api/v1/users/', usersRouter);
app.use('/api/v1/tours/', toursRouter);
app.use('/api/v1/reviews', reviewRouter);
app.use('/api/v1/bookings', bookingRouter);

app.all('*', (req, res, next) => {
  next(new AppError(`Cant't find ${req.originalUrl} on this server!`, 404));
});

app.use(globalErrorHandler);

module.exports = app;
