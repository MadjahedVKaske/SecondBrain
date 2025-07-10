import { useState, useEffect } from "react";
import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock,
  MessageCircle,
  Send,
  Settings
} from "lucide-react";

const Contacts = () => {
  const { toast } = useToast();
  const [formData, setFormData] = useState({
    name: "",
    company: "",
    phone: "",
    email: "",
    message: ""
  });
  const [telegramConfig, setTelegramConfig] = useState({
    botToken: "",
    chatId: ""
  });
  const [showTelegramConfig, setShowTelegramConfig] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const savedConfig = localStorage.getItem("telegram-config");
    if (savedConfig) {
      setTelegramConfig(JSON.parse(savedConfig));
    }
  }, []);

  const saveTelegramConfig = () => {
    localStorage.setItem("telegram-config", JSON.stringify(telegramConfig));
    setShowTelegramConfig(false);
    toast({
      title: "Настройки сохранены",
      description: "Конфигурация Telegram сохранена в браузере"
    });
  };

  const sendToTelegram = async (message: string) => {
    if (!telegramConfig.botToken || !telegramConfig.chatId) {
      throw new Error("Telegram не настроен");
    }

    const url = `https://api.telegram.org/bot${telegramConfig.botToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        chat_id: telegramConfig.chatId,
        text: message,
        parse_mode: "HTML"
      }),
    });

    if (!response.ok) {
      throw new Error("Ошибка отправки в Telegram");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.message) {
      toast({
        title: "Ошибка",
        description: "Заполните обязательные поля: имя, телефон и сообщение",
        variant: "destructive"
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const message = `
🔔 <b>Новая заявка с сайта BURO1</b>

👤 <b>Имя:</b> ${formData.name}
🏢 <b>Компания:</b> ${formData.company || "Не указана"}
📞 <b>Телефон:</b> ${formData.phone}
📧 <b>Email:</b> ${formData.email || "Не указан"}

💬 <b>Сообщение:</b>
${formData.message}

⏰ <b>Время:</b> ${new Date().toLocaleString("ru-RU")}
      `.trim();

      await sendToTelegram(message);

      toast({
        title: "Заявка отправлена!",
        description: "Мы получили вашу заявку и свяжемся с вами в ближайшее время"
      });

      setFormData({
        name: "",
        company: "",
        phone: "",
        email: "",
        message: ""
      });

    } catch (error) {
      console.error("Ошибка отправки:", error);
      toast({
        title: "Ошибка отправки",
        description: error instanceof Error ? error.message : "Попробуйте еще раз или свяжитесь с нами напрямую",
        variant: "destructive"
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Контакты
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Свяжитесь с нами любым удобным способом. Ответим на все вопросы и поможем выбрать оптимальное решение.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Контактная информация */}
            <div className="space-y-8">
              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-2xl">Как с нами связаться</CardTitle>
                  <CardDescription>
                    Выберите удобный способ связи
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <Phone className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Телефон</p>
                      <a href="tel:+79262654429" className="text-primary hover:underline">
                        +7(926) 265-44-29
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <Mail className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Email</p>
                      <a href="mailto:info@buro1.ru" className="text-primary hover:underline">
                        info@buro1.ru
                      </a>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <MapPin className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Адрес</p>
                      <p className="text-muted-foreground">Московская область, Красногорск, Ильинское шоссе 1А, 3 этаж, офис 15.6</p>
                    </div>
                  </div>

                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center">
                      <Clock className="w-6 h-6 text-primary-foreground" />
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Время работы</p>
                      <p className="text-muted-foreground">Пн-Пт: 9:00-18:00</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-xl">Мессенджеры</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <a href="https://t.me/BorisovEvgen" className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span>Telegram: @BorisovEvgen</span>
                  </a>
                  <a href="https://wa.me/79262654429" className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp: +7(926) 265-44-29</span>
                  </a>
                </CardContent>
              </Card>
            </div>

            {/* Форма обратной связи */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl">Оставить заявку</CardTitle>
                <CardDescription>
                  Опишите вашу задачу, и мы свяжемся с вами в течение часа
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowTelegramConfig(!showTelegramConfig)}
                    className="mb-4"
                  >
                    <Settings className="w-4 h-4 mr-2" />
                    Настроить Telegram
                  </Button>

                  {showTelegramConfig && (
                    <Card className="mb-4 border-dashed">
                      <CardHeader>
                        <CardTitle className="text-lg">Настройки Telegram</CardTitle>
                        <CardDescription>
                          Введите данные вашего Telegram бота для получения заявок
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <label className="text-sm font-medium mb-2 block">Bot Token</label>
                          <Input
                            type="password"
                            placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                            value={telegramConfig.botToken}
                            onChange={(e) => setTelegramConfig(prev => ({ ...prev, botToken: e.target.value }))}
                          />
                        </div>
                        <div>
                          <label className="text-sm font-medium mb-2 block">Chat ID</label>
                          <Input
                            placeholder="-1001234567890"
                            value={telegramConfig.chatId}
                            onChange={(e) => setTelegramConfig(prev => ({ ...prev, chatId: e.target.value }))}
                          />
                        </div>
                        <Button onClick={saveTelegramConfig} size="sm">
                          Сохранить настройки
                        </Button>
                      </CardContent>
                    </Card>
                  )}
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Имя *</label>
                      <Input 
                        placeholder="Ваше имя" 
                        required 
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Компания</label>
                      <Input 
                        placeholder="Название компании" 
                        value={formData.company}
                        onChange={(e) => setFormData(prev => ({ ...prev, company: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Телефон *</label>
                      <Input 
                        placeholder="+7(926) 265-44-29" 
                        required 
                        value={formData.phone}
                        onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Email</label>
                      <Input 
                        type="email" 
                        placeholder="email@example.com" 
                        value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Сообщение *</label>
                    <Textarea 
                      placeholder="Опишите вашу задачу или вопрос..."
                      rows={4}
                      required 
                      value={formData.message}
                      onChange={(e) => setFormData(prev => ({ ...prev, message: e.target.value }))}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    variant="hero" 
                    size="lg" 
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    <Send className="w-5 h-5 mr-2" />
                    {isSubmitting ? "Отправляем..." : "Отправить заявку"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Contacts;