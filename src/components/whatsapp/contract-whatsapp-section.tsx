async function handleSend() {
    if (!message.trim()) return
    setBusy(true); setError(null)

    const result = await sendContractWhatsApp(contractId, phone, message, templateId || null, selectedInstance || null)
    setBusy(false)

    if (result.error) {
      setError(result.error)
    } else {
      setMessage('')
      setTemplateId('')
      
      // Injeção otimista bypassando o TypeScript restrito
      const res = result as any
      if (res.message || res.data) {
        addMessage((res.message || res.data) as WhatsAppLog)
      } else if (res.id) {
        addMessage(res as WhatsAppLog)
      }
    }
  }

  async function handleFileUpload() {
    const file = fileInputRef.current?.files?.[0]
    if (!file || !phone) {
      if (!phone) setError('Informe o telefone antes de enviar um arquivo.')
      return
    }
    setBusy(true)
    setError(null)

    const supabase = createClient()
    const storagePath = `whatsapp-media/${contractId}/${Date.now()}-${sanitizeStorageFileName(file.name)}`
    const { error: uploadError } = await supabase.storage.from('proposal-files').upload(storagePath, file)

    if (uploadError) {
      setBusy(false)
      setError(`Falha no upload: ${uploadError.message}`)
      return
    }

    const publicUrl = `${window.location.origin}/api/email-assets/${storagePath}`
    const mediaType = file.type.startsWith('image/') ? 'image' : 'document'
    const result = await sendContractWhatsAppMedia(contractId, phone, publicUrl, mediaType, file.name)

    setBusy(false)
    if (result.error) setError(result.error)
    else {
      if (fileInputRef.current) fileInputRef.current.value = ''
      
      // Feedback instantâneo para arquivos bypassando o TypeScript
      const res = result as any
      if (res.message || res.data) {
        addMessage((res.message || res.data) as WhatsAppLog)
      } else if (res.id) {
        addMessage(res as WhatsAppLog)
      }
    }
  }
