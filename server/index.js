require('dotenv').config()
const express = require('express')
const nodemailer = require("nodemailer");
const cors = require('cors')
const cookieParser = require('cookie-parser')
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb')
const jwt = require('jsonwebtoken')
const morgan = require('morgan')

const port = process.env.PORT || 9000
const app = express()
// middleware
const corsOptions = {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  credentials: true,
  optionSuccessStatus: 200,
}
app.use(cors(corsOptions))

app.use(express.json())
app.use(cookieParser())
app.use(morgan('dev'))

// const verifyToken = async (req, res, next) => {
//   const token = req.cookies?.token

//   if (!token) {
//     return res.status(401).send({ message: 'unauthorized access' })
//   }
//   jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
//     if (err) {
//       console.log(err)
//       return res.status(401).send({ message: 'unauthorized access' })
//     }
//     req.user = decoded
//     next()
//   })
// }

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.9cbr8.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
})
async function run() {
  try {
    const db = client.db('plantNet-session')
    const usersCollection = db.collection('users')
    const plantsCollection = db.collection('plants')
    const ordersCollection = db.collection('orders')
    // Generate jwt token
    app.post('/jwt', async (req, res) => {
      const email = req.body
      const token = jwt.sign(email, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '365d',
      })
      res
        .cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
        })
        .send({ success: true })
    })
    // Logout
    app.get('/logout', async (req, res) => {
      try {
        res
          .clearCookie('token', {
            maxAge: 0,
            secure: process.env.NODE_ENV === 'production',
            sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'strict',
          })
          .send({ success: true })
      } catch (err) {
        res.status(500).send(err)
      }
    })
    const verifyToken = async (req, res, next) => {
      const token = req.cookies?.token
    
      if (!token) {
        return res.status(401).send({ message: 'unauthorized access' })
      }
      jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
          console.log(err)
          return res.status(401).send({ message: 'unauthorized access' })
        }
        req.user = decoded
        next()
      })
     
    }
    const sendMail = (emailAddress, emailData) => {
      const transporter = nodemailer.createTransport({
        host: "smtp.gmail.com",
        port: 587,
        secure: false, // true for port 465, false for other ports
        auth: {
          user: process.env.NODEMAILER_USER,
          pass: process.env.NODEMAILER_PASS,
        },
      });
      transporter.verify((error, success) => {
        if(error){
          console.log(error);
        }
        else{
          console.log(success);
        }
      })
      const mailBody = {
        from: process.env.NODEMAILER_USER, // sender address
        to: emailAddress, // list of receivers
        subject: emailData?.subject, // Subject line
        html: `<p>${emailData?.message}</p>`, // html body
      }
      transporter.sendMail(mailBody, (error, info) => {
        if(error){
          console.log(error);
        }
        else{
          console.log(info);
          console.log('nodemailer', info?.response);
        }
      })
      
    }
    const verifyAdmin = async(req, res, next) => {
      console.log('data from admin', req.user?.email);
      const email = req.user?.email 
      const query = {email}
      const result = await usersCollection.findOne(query)
      if(!result || result?.role !== 'admin') return res.status(403).send({message: 'Forbidden Access Admin Only'})
        next()
    }
    const verifySeller = async(req, res, next) => {
      console.log('data from admin', req.user?.email);
      const email = req.user?.email 
      const query = {email}
      const result = await usersCollection.findOne(query)
      if(!result || result?.role !== 'seller') return res.status(403).send({message: 'Forbidden Access Admin Only'})
        next()
    }
    // my crud operation start here 
    // save user info to database 
    app.post('/users/:email', async(req, res) => {
      const email = req.params.email
      const query = {email}
      const user = req.body 
      const isExists = await usersCollection.findOne(query)
      if(isExists) return res.send(isExists)
        const result = await usersCollection.insertOne({...user, timestamp: Date.now(),
      role: 'customer'})
      res.send(result)
    })
    // update user request for become a seller admin step -1  become a seller page 
    app.patch('/users/:email', verifyToken,  async(req, res) => {
      const email = req.params.email 
      const query = {email}
      const user = await usersCollection.findOne(query)
      if(!user || user?.status === 'Requested') return res.status(409).send('You have already send request for seller')
        const updateDoc = {
      $set: {
        status: 'Requested',
      }
    }
    const result = await usersCollection.updateOne(query, updateDoc)
    res.send(result)
    })
    // get user role in ui very very importent step-2 data collect by custom hook use role
    app.get('/users/role/:email', async(req, res) => {
      const email = req.params.email 
      const result = await usersCollection.findOne({email})
      res.send({role: result?.role})
    })
    // data collect for manage user page  step - 3
    app.get('/all-users/:email',verifyToken, verifyAdmin,  async(req, res) => {
      const email = req.params.email
      const query = {email: {$ne: email}}
      const result = await usersCollection.find(query).toArray()
      res.send(result)
    })
      // update role and status manage user page  step - 4
      app.patch('/user/role/:email', verifyToken, verifyAdmin,   async(req, res) => {
        const {role} = req.body
        const email = req.params.email
        const query = {email}
        const updateDoc = {
          $set: {role, status: 'Verified'},
        }
        const result = await usersCollection.updateOne(query, updateDoc)
        res.send(result)
      })
    // plantcollection 
    //work-2  post plants data in plantsCollection
    app.post('/plants', verifyToken, verifySeller,   async(req, res) => {
      const plants = req.body 
      const result = await plantsCollection.insertOne(plants)
      res.send(result)
    })
    app.get('/plants', async(req, res) => {
      const result = await plantsCollection.find().toArray()
      res.send(result)
    })
    app.get('/plants/:id', async(req, res) => {
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const result = await plantsCollection.findOne(query)
      res.send(result)
    })
      // delete plant 
      app.delete('/plants/:id', verifyToken, verifySeller, async(req, res) => {
        const id = req.params.id 
        console.log('kdjfdkdjfkdjjjjjkjkjkkjkj', id);
        const query = {_id: new ObjectId(id)}
        const result = await plantsCollection.deleteOne(query)
        console.log(result);
        res.send(result)
      })
    // get inventory data for seller 
    app.get('/plants-seller', verifyToken,   async(req, res) => {
      const email = req.user?.email 
      const result = await plantsCollection.find({'seller.email': email}).toArray()
      res.send(result)
    })
  
    // order collection start here 
    app.post('/orders', verifyToken,  async(req, res) => {
      const order = req.body 
      const result = await ordersCollection.insertOne(order)
      // to customer 
      if(result?.insertedId){
        sendMail(order?.customer?.email, {
          subject: 'Order Successful',
          message: `You placed an order successfully. Transaction id ${result.insertedId}.`
        })
        // to seller 
      }
      if(result.insertedId){
        sendMail(order?.seller, {
          subject: 'Hurray, You have an order proceed',
          message: `You placed an order successfully. Transaction id ${order?.customer?.name}.`
        })  
      }
      res.send(result)
    })
    // manage quantity
    app.patch('/orders/quantity/:id', verifyToken,  async(req, res) => {
      const {updateQuantity, status} = req.body
      console.log('before ' ,updateQuantity);
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      let updateDoc = {
        $inc: {
          quantity: -updateQuantity,
        }
      }
      if(status === 'increase') {
         updateDoc = {
          $inc: {
            quantity: updateQuantity,
          }
        }
      }
      // console.log('after update' ,updateDoc);
      const result = await plantsCollection.updateOne(query, updateDoc)
      res.send(result)
    })
    app.get('/customer-order/:email', verifyToken,  async(req, res) => {
      const email = req.params.email 
      const query = {'customer.email': email}
      const result = await ordersCollection.aggregate([
        {
          $match: query,
        },
        {
          $addFields: {
            plantId: {$toObjectId: '$plantId'},
          },
        },
        {
          $lookup: {
            from: 'plants',
            localField: 'plantId',
            foreignField: '_id',
            as: 'plants'
          },
        },
        {$unwind: '$plants'},
        {
          $addFields: {
            name: '$plants.name',
            image: '$plants.image',
            category: '$plants.category'
          },
        },
        {
          $project: {
            plants: 0,
          },
        },
      ]).toArray()
      res.send(result)

    })
    // route for manage order page  it is query by seller email
    app.get('/seller-order/:email',verifyToken, verifySeller,  async(req, res) => {
      const email = req.params.email 
      const query = {seller: email}
      const result = await ordersCollection.aggregate([
        {
          $match: query,
        },
        {
          $addFields: {
            plantId: {$toObjectId: '$plantId'},
          },
        },
        {
          $lookup: {
            from: 'plants',
            localField: 'plantId',
            foreignField: '_id',
            as: 'plants'
          },
        },
        {$unwind: '$plants'},
        {
          $addFields: {
            name: '$plants.name',
          
          },
        },
        {
          $project: {
            plants: 0,
          },
        },
      ]).toArray()
      res.send(result)
    })
    // status update from seller manage order 
    app.patch('/orders/:id', verifyToken, verifySeller, async(req, res) => {
      const id = req.params.id 
      const {status} = req.body
      const query = {_id: new ObjectId(id)}
      const updateDoc = {
        $set: {status},
      }
     const result = await ordersCollection.updateOne(query, updateDoc)
     res.send(result)
    })
    // delete operation for customer and seller 
    app.delete('/order/:id', async(req, res) => {
      const id = req.params.id 
      const query = {_id: new ObjectId(id)}
      const order = await ordersCollection.findOne(query)
      if(order.status === 'Delivered') return res.status(409).send('Your product already delivered')
        const result = await ordersCollection.deleteOne(query)
      res.send(result)
    })

    // Send a ping to confirm a successful connection
    await client.db('admin').command({ ping: 1 })
    console.log(
      'Pinged your deployment. You successfully connected to MongoDB!'
    )
  } finally {
    // Ensures that the client will close when you finish/error
  }
}
run().catch(console.dir)

app.get('/', (req, res) => {
  res.send('Hello from plantNet Server..')
})

app.listen(port, () => {
  console.log(`plantNet is running on port ${port}`)
})
