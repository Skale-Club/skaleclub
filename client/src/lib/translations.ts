// Translation keys and values
// English is the default language (data in database)
// Portuguese translations are provided here

export const translations = {
  pt: {
    // Navbar
    'Home': 'Início',
    'Login': 'Entrar',
    'Logout': 'Sair',
    'Admin Panel': 'Painel Admin',
    
    // Hero Section
    'Learn How to Generate Your Own Clients in the USA': 'Aprenda a Gerar Seus Próprios Clientes nos EUA',
    '1-on-1 Mentorship in Digital Marketing for Brazilian Entrepreneurs': 'Mentoria 1-a-1 em Marketing Digital para Empresários Brasileiros',
    'Schedule Free Consultation': 'Agendar Conversa Gratuita',
    'Schedule a Free Call': 'Agendar Conversa Gratuita',
    
    // Trust Badges / Benefits
    '100% Personalized Mentorship': 'Mentoria 100% Personalizada',
    'No generic strategies. Everything focused on YOUR business.': 'Zero estratégias genéricas. Tudo focado no SEU negócio.',
    'Learn What Really Works': 'Aprenda o Que Realmente Funciona',
    'No fluff. Only proven techniques in the American market.': 'Sem enrolação. Só técnicas comprovadas no mercado americano.',
    'Support Until You Master It': 'Suporte Até Você Dominar',
    "We don't abandon you after classes. We follow your results.": 'Não te abandonamos após as aulas. Acompanhamos seus resultados.',
    
    // Common
    'Services': 'Serviços',
    'About': 'Sobre',
    'Contact': 'Contato',
    'FAQ': 'Perguntas Frequentes',
    'Book Now': 'Agendar Agora',
    'Learn More': 'Saiba Mais',
    'Get Started': 'Começar',
    'Submit': 'Enviar',
    'Cancel': 'Cancelar',
    'Save': 'Salvar',
    'Edit': 'Editar',
    'Delete': 'Deletar',
    'Add': 'Adicionar',
    'Update': 'Atualizar',
    'Search': 'Buscar',
    'Filter': 'Filtrar',
    'Loading...': 'Carregando...',
    'Yes': 'Sim',
    'No': 'Não',
    'Close': 'Fechar',
    'Back': 'Voltar',
    'Next': 'Próximo',
    'Previous': 'Anterior',
    'Continue': 'Continuar',
    'Finish': 'Finalizar',
    
    // Forms
    'Name': 'Nome',
    'Email': 'E-mail',
    'Phone': 'Telefone',
    'Message': 'Mensagem',
    'First Name': 'Primeiro Nome',
    'Last Name': 'Sobrenome',
    'Password': 'Senha',
    'Confirm Password': 'Confirmar Senha',
    'Description': 'Descrição',
    'Title': 'Título',
    'Category': 'Categoria',
    'Price': 'Preço',
    'Duration': 'Duração',
    'Date': 'Data',
    'Time': 'Hora',
    
    // Booking
    'Select Service': 'Selecionar Serviço',
    'Select Date': 'Selecionar Data',
    'Select Time': 'Selecionar Horário',
    'Your Information': 'Suas Informações',
    'Booking Summary': 'Resumo da Reserva',
    'Total': 'Total',
    'Subtotal': 'Subtotal',
    'Tax': 'Imposto',
    'Confirm Booking': 'Confirmar Reserva',
    'Booking Confirmed': 'Reserva Confirmada',
    'Thank you for your booking!': 'Obrigado pela sua reserva!',
    
    // Admin
    'Dashboard': 'Painel',
    'Settings': 'Configurações',
    'Users': 'Usuários',
    'Bookings': 'Reservas',
    'Categories': 'Categorias',
    'Subcategories': 'Subcategorias',
    'Company Settings': 'Configurações da Empresa',
    'Integration Settings': 'Configurações de Integração',
    'Business Hours': 'Horário de Funcionamento',
    'SEO Settings': 'Configurações de SEO',
    
    // Messages
    'Are you sure?': 'Tem certeza?',
    'This action cannot be undone.': 'Esta ação não pode ser desfeita.',
    'Success!': 'Sucesso!',
    'Error': 'Erro',
    'Something went wrong.': 'Algo deu errado.',
    'Please fill in all required fields.': 'Por favor, preencha todos os campos obrigatórios.',
    'Invalid email address.': 'Endereço de e-mail inválido.',
    'Password is too short.': 'A senha é muito curta.',
    'Passwords do not match.': 'As senhas não coincidem.',
    
    // Time
    'Monday': 'Segunda-feira',
    'Tuesday': 'Terça-feira',
    'Wednesday': 'Quarta-feira',
    'Thursday': 'Quinta-feira',
    'Friday': 'Sexta-feira',
    'Saturday': 'Sábado',
    'Sunday': 'Domingo',
    'Mon': 'Seg',
    'Tue': 'Ter',
    'Wed': 'Qua',
    'Thu': 'Qui',
    'Fri': 'Sex',
    'Sat': 'Sáb',
    'Sun': 'Dom',
    
    // Months
    'January': 'Janeiro',
    'February': 'Fevereiro',
    'March': 'Março',
    'April': 'Abril',
    'May': 'Maio',
    'June': 'Junho',
    'July': 'Julho',
    'August': 'Agosto',
    'September': 'Setembro',
    'October': 'Outubro',
    'November': 'Novembro',
    'December': 'Dezembro',
  }
} as const;

export type TranslationKey = keyof typeof translations.pt;
