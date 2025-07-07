import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, MessageCircle } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-secondary border-t border-border">
      <div className="container mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {/* Company Info */}
          <div>
            <div className="flex items-center space-x-2 mb-4">
              <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold">B1</span>
              </div>
              <span className="text-xl font-bold text-foreground">BURO1</span>
            </div>
            <p className="text-muted-foreground mb-4">
              Профессиональные решения для автоматизации бизнеса на платформе 1С
            </p>
            <div className="space-y-2">
              <a
                href="tel:+79999999999"
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="w-4 h-4" />
                <span>+7 (999) 999-99-99</span>
              </a>
              <a
                href="mailto:info@buro1.ru"
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="w-4 h-4" />
                <span>info@buro1.ru</span>
              </a>
              <div className="flex items-center space-x-2 text-muted-foreground">
                <MapPin className="w-4 h-4" />
                <span>г. Москва, ул. Примерная, д. 1</span>
              </div>
            </div>
          </div>

          {/* Services */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Услуги</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/services" className="text-muted-foreground hover:text-foreground transition-colors">
                  Внедрение 1С
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-muted-foreground hover:text-foreground transition-colors">
                  Интеграции
                </Link>
              </li>
              <li>
                <Link to="/marking" className="text-muted-foreground hover:text-foreground transition-colors">
                  Маркировка
                </Link>
              </li>
              <li>
                <Link to="/services" className="text-muted-foreground hover:text-foreground transition-colors">
                  Telegram-боты
                </Link>
              </li>
            </ul>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Быстрые ссылки</h3>
            <ul className="space-y-2">
              <li>
                <Link to="/database-help" className="text-muted-foreground hover:text-foreground transition-colors">
                  Какая база мне нужна?
                </Link>
              </li>
              <li>
                <Link to="/audit" className="text-muted-foreground hover:text-foreground transition-colors">
                  Аудит 1С
                </Link>
              </li>
              <li>
                <Link to="/cases" className="text-muted-foreground hover:text-foreground transition-colors">
                  Кейсы
                </Link>
              </li>
              <li>
                <Link to="/about" className="text-muted-foreground hover:text-foreground transition-colors">
                  О компании
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Form */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Связаться с нами</h3>
            <div className="space-y-3">
              <a
                href="https://t.me/buro1"
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>Telegram</span>
              </a>
              <a
                href="https://wa.me/79999999999"
                className="flex items-center space-x-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>WhatsApp</span>
              </a>
            </div>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 text-center">
          <p className="text-muted-foreground">
            © {new Date().getFullYear()} BURO1. Все права защищены.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;