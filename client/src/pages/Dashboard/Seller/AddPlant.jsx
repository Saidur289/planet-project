import { Helmet } from 'react-helmet-async'
import AddPlantForm from '../../../components/Form/AddPlantForm'
import useAuth from '../../../hooks/useAuth'
import useAxiosSecure from '../../../hooks/useAxiosSecure'
import { useState } from 'react'
import { imageUpload } from '../../../api/utils'
import toast from 'react-hot-toast'

const AddPlant = () => {
  const {user} = useAuth()
  const axiosSecure = useAxiosSecure()
  const [uploadButtonText, setUploadButtonText] = useState({
    image: {name: 'Upload Button'}
  })
  const [loading, setLoading] = useState(false)
  const handleSubmit = async e => {
    e.preventDefault()
    setLoading(true)
    const form = e.target 
    const name = form.name.value 
    const description = form.description.value 
    const category = form.category.value 
    const price = parseFloat(form.price.value)
    const quantity = parseInt(form.quantity.value)
    const image = form.image.files[0]
    const imageUrl = await imageUpload(image)
    const seller = {
      name: user?.displayName,
      image: user?.photoURL,
      email: user?.email,
    } 
    const formdata = {name, description, category, price, quantity, image:imageUrl, seller}
    console.table({formdata})
    try{
      // post request
       await axiosSecure.post('/plants', formdata)
       toast.success('Data Added Successfully')

    }catch(err){
      console.log(err);
    }
    finally{
      // after fetch loading false
      setLoading(false)
    }


  }
  return (
    <div>
      <Helmet>
        <title>Add Plant | Dashboard</title>
      </Helmet>

      {/* Form */}
      <AddPlantForm handleSubmit = {handleSubmit} uploadButtonText = {uploadButtonText} setUploadButtonText = {setUploadButtonText} loading = {loading}/>
    </div>
  )
}

export default AddPlant
