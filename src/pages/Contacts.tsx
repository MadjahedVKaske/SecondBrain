import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Phone, 
  Mail, 
  MapPin, 
  Clock,
  MessageCircle,
  Send
} from "lucide-react";

const Contacts = () => {
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
                        +7-926-265-44-29
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
                      <p className="text-muted-foreground">Поддержка: 24/7</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="border-border">
                <CardHeader>
                  <CardTitle className="text-xl">Мессенджеры</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <a href="https://t.me/buro1" className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span>Telegram: @buro1</span>
                  </a>
                  <a href="https://wa.me/79262654429" className="flex items-center space-x-3 text-muted-foreground hover:text-foreground transition-colors">
                    <MessageCircle className="w-5 h-5" />
                    <span>WhatsApp: +7-926-265-44-29</span>
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
                <form className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Имя *</label>
                      <Input placeholder="Ваше имя" required />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Компания</label>
                      <Input placeholder="Название компании" />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Телефон *</label>
                      <Input placeholder="+7-926-265-44-29" required />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Email</label>
                      <Input type="email" placeholder="email@example.com" />
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium mb-2 block">Сообщение *</label>
                    <Textarea 
                      placeholder="Опишите вашу задачу или вопрос..."
                      rows={4}
                      required 
                    />
                  </div>

                  <Button variant="hero" size="lg" className="w-full">
                    <Send className="w-5 h-5 mr-2" />
                    Отправить заявку
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