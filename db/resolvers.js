const Usuario = require('../models/Usuario')
const Producto = require('../models/Producto')
const Cliente = require('../models/Cliente')
const Pedido = require('../models/Pedido')
const bcryptjs = require('bcryptjs')
const jwt = require('jsonwebtoken')
require('dotenv').config({path: 'variables.env'})

const crearToken = (usuario,secret,expiracion) => {
    //console.log(`${secret}`)

    //const laSecret = "hola"

    const {id,email,nombre,apellido} = usuario

    return jwt.sign( { id,email,nombre,apellido }, secret, { expiresIn: expiracion } )

}

//Resolvers

const resolvers = {
    Query: {
        obtenerUsuario: async(_,{},ctx) => {

            return ctx.usuario
        },
        obtenerProductos: async () => {
            try{
                const productos = await Producto.find({})

                return productos
            }catch(error){
                console.log(error)
            }
        },
        obtenerProducto: async (_,{id}) => {
            let producto = await Producto.findById(id)

            if(!producto){
                throw new Error("Producto no encontrado")
            }

            return producto
        },
        obtenerClientes: async () => {
            try{
                const clientes = await Cliente.find({})

                return clientes
            }catch(error){
                console.log(error)
            }
        },
        obtenerClientesVendedor: async (_,{},ctx) => {
            let clientes = await Cliente.find({vendedor: ctx.usuario.id.toString()})

            return clientes
        },
        obtenerCliente: async (_,{id},ctx) => {
            let cliente = await Cliente.findById(id)
            let isYourClient = cliente ? await cliente.vendedor.toString() === ctx.usuario.id.toString() : false

            if(!cliente || !isYourClient){
                throw new Error("Cliente no encontrado")
            }

            return cliente
        },
        obtenerPedidos: async () => {
            try{
                const pedidos = await Pedido.find({})

                return pedidos
            }catch(error){
                console.log(error)
            }
        },
        obtenerPedidosVendedor: async (_,{},ctx) => {
            try{
                let pedidos = await Pedido.find({vendedor: ctx.usuario.id.toString()})

                return pedidos
            }catch(error){
                console.log(error)
            }
        },
        obtenerPedido: async (_,{id},ctx) => {
            let pedido = await Pedido.findById(id)
            let isYourClient = pedido ? await pedido.vendedor.toString() === ctx.usuario.id.toString() : false

            if(!pedido || !isYourClient){
                throw new Error("Pedido no encontrado")
            }

            return pedido
        },
        obtenerPedidosEstado: async (_, { estado},ctx) => {
            console.log(ctx.usuario)

            const pedidos = await Pedido.find({vendedor: ctx.usuario.id, estado})

            return pedidos
        },
        mejoresClientes: async (_, {input}) => {
            const clientes = await Pedido.aggregate([
                { $match : { estado : "COMPLETADO"} },
                {$group: {
                    _id: "$cliente",
                    total: { $sum : "$total"}
                }},
                {
                    $lookup: {
                        from: "clientes",
                        localField: '_id',
                        foreignField: "_id",
                        as: "cliente"
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort : { total : -1 }
                }
            ])

            return clientes
        },
        mejoresVendedores: async (_, {input}) => {
            const vendedores = await Pedido.aggregate([
                { $match : { estado : "COMPLETADO"} },
                {$group: {
                    _id: "$vendedor",
                    total: { $sum : "$total"}
                }},
                {
                    $lookup: {
                        from: "usuarios",
                        localField: '_id',
                        foreignField: "_id",
                        as: "vendedor"
                    }
                },
                {
                    $limit: 3
                },
                {
                    $sort : { total : -1 }
                }
            ])

            return vendedores
        },
        buscarProducto: async(_,{texto}) => {
            const productos = await Producto.find({$text: { $search: texto }}).limit(10)

            return productos
        }
    },
    Mutation:{
        nuevoUsuario: async (_,{input}) => {

            const {email, password} = input

            // Revisar si el usuario ya esta registrado

            const existeUsuario = await Usuario.findOne({email})
            //console.log("Existe usuario: ", existeUsuario)

            if(existeUsuario){
                throw new Error('El usuario ya esta registrado')
            }

            //Hashear password

            const salt = await bcryptjs.genSalt(10);
            input.password = await bcryptjs.hash(password,salt)

            //Guardarlo en la base de datos

            try {
                const usuario = new Usuario(input)
                usuario.save()
                return usuario
            } catch (error) {
                console.log(error)
            }
        },
        autenticarUsuario: async (_,{input}) => {
            // Si el usuario existe

            const {email,password} = input

            const existeUsuario = await Usuario.findOne({email})
            if(!existeUsuario){
                throw new Error('El usuario no existe')
            }

            //Revisar si el password es correcto

            const passwordCorrecto = await bcryptjs.compare(password, existeUsuario.password)
            if(!passwordCorrecto){
                throw new Error('El password es incorrecto')
            }

            //Crear el token

            return {
                token: crearToken(existeUsuario, process.env.SECRET, '24h')
            }
        },
        nuevoProducto: async (_,{input}) => {
            try{
                const producto = new Producto(input)

                // almacenar en DB
                const resultado = await producto.save()

                return resultado

            }catch (error){
                console.log(error)
            }
        },
        actualizarProducto: async (_,{id, input}) => {
            let producto = await Producto.findById(id)

            if(!producto){
                throw new Error("Producto no encontrado")
            }

            //guardar en la base de datos
            producto = await Producto.findOneAndUpdate({_id : id}, input, { new: true})

            return producto
        },
        eliminarProducto: async(_,{id}) => {
            let producto = await Producto.findById(id)

            if(!producto){
                throw new Error("Producto no encontrado")
            }

            await Producto.findOneAndDelete({_id : id})

            return "Producto eliminado"
        },
        nuevoCliente: async (_,{input},ctx) => {

            const {email} = input

            let cliente = await Cliente.findOne({email})
            if(cliente) {
                throw new Error('Ese cliente ya esta registrado')
            }

            const nuevoCliente = new Cliente(input)

            nuevoCliente.vendedor = ctx.usuario.id

            try{
                const resultado = await nuevoCliente.save()
                return resultado
            }catch(error){
                console.log(error)
            }
        },
        actualizarCliente: async (_,{id, input},ctx) => {
            let cliente = await Cliente.findById(id)
            let isYourClient = cliente ? await cliente.vendedor.toString() === ctx.usuario.id.toString() : false

            if(false || !isYourClient){
                throw new Error("Cliente no encontrado")
            }

            //guardar en la base de datos
            cliente = await Cliente.findOneAndUpdate({_id : id}, input, { new: true})

            return cliente
        },
        eliminarCliente: async(_,{id},ctx) => {
            let cliente = await Cliente.findById(id)
            let isYourClient = cliente ? await cliente.vendedor.toString() === ctx.usuario.id.toString() : false

            if(!cliente || !isYourClient){
                throw new Error("Cliente no encontrado")
            }

            await Cliente.findOneAndDelete({_id : id})

            return "Cliente eliminado"
        },
        nuevoPedido: async (_, {input}, ctx) => {
            const {cliente,pedido} = input
            let isReal = await Cliente.findById(cliente)
            let isYourClient = isReal ? await isReal.vendedor.toString() === ctx.usuario.id.toString() : false

            if(!isReal || !isYourClient){
                throw new Error("Cliente no encontrado")
            }

            for await ( const articulo of pedido){
                const {id,cantidad} = articulo

                const producto = await Producto.findById(id)

                if(!producto){
                    throw new Error("El articulo no existe")
                }

                if(cantidad > producto.existencia){
                    throw new Error("El articulo excede la cantidad disponible")
                }else{
                    producto.existencia = producto.existencia - articulo.cantidad

                    await producto.save()
                }
            }

            const newPedido = new Pedido(input)

            newPedido.vendedor = ctx.usuario.id

            try{
                const resultado = await newPedido.save()
                return resultado
            }catch(error){
                console.log(error)
            }

        },
        actualizarPedido: async (_,{id, input},ctx) => {
            let pedido = await Pedido.findById(id)
            let isYourPedido = pedido ? await pedido.vendedor.toString() === ctx.usuario.id.toString() : false
            let existeCliente = await Cliente.findById(input.cliente)

            if(!pedido || !isYourPedido){
                throw new Error("Pedido no encontrado")
            }

            if(!existeCliente){
                throw new Error("Cliente no encontrado")
            }

            if(existeCliente.vendedor.toString() !== ctx.usuario.id){
                throw new Error("No es tu cliente")
            }

            if(pedido.estado === "COMPLETADO"){
                throw new Error("El pedido ya fue completado")
            }

            for await ( const articulo of input.pedido){
                const {id,cantidad} = articulo

                const producto = await Producto.findById(id)

                if(!producto){
                    throw new Error("El articulo no existe")
                }

                if(cantidad > producto.existencia){
                    throw new Error("El articulo excede la cantidad disponible")
                }else{
                    producto.existencia = producto.existencia - articulo.cantidad

                    await producto.save()
                }
            }
               

            //guardar en la base de datos
            const resultado = await Pedido.findOneAndUpdate({_id : id}, input, { new: true})

            return resultado
        },
        eliminarPedido: async(_,{id},ctx) => {
            let pedido = await Pedido.findById(id)
            let isYourPedido = pedido ? await pedido.vendedor.toString() === ctx.usuario.id.toString() : false

            if(!pedido || !isYourPedido){
                throw new Error("Pedido no encontrado")
            }

            await Pedido.findOneAndDelete({_id : id})

            return "Cliente eliminado"
        },
    }
}

module.exports = resolvers