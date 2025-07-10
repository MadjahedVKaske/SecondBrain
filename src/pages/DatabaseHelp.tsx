import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from "react-router-dom";
import { useState } from "react";
import { 
  Building2, 
  Users, 
  ShoppingCart, 
  Calculator, 
  ArrowRight,
  CheckCircle,
  Info
} from "lucide-react";

const DatabaseHelp = () => {
  const [selectedBusiness, setSelectedBusiness] = useState("");
  const [selectedSize, setSelectedSize] = useState("");
  const [recommendation, setRecommendation] = useState(null);

  const businessTypes = [
    { id: "retail", label: "Розничная торговля", icon: ShoppingCart },
    { id: "wholesale", label: "Оптовая торговля", icon: Building2 },
    { id: "manufacturing", label: "Производство", icon: Calculator },
    { id: "service", label: "Услуги", icon: Users },
  ];

  const companySizes = [
    { id: "micro", label: "Микробизнес (до 5 сотрудников)", employees: "до 5" },
    { id: "small", label: "Малый бизнес (6-50 сотрудников)", employees: "6-50" },
    { id: "medium", label: "Средний бизнес (51-250 сотрудников)", employees: "51-250" },
    { id: "large", label: "Крупный бизнес (250+ сотрудников)", employees: "250+" },
  ];

  const recommendations = {
    "retail-micro": {
      product: "1С:Управление нашей фирмой (УНФ)",
      description: "Идеальное решение для небольшого розничного бизнеса",
      features: ["Касса и продажи", "Складской учет", "Простая отчетность", "Интеграция с банком"],
      price: "от 15 000 ₽",
      implementation: "1-2 недели"
    },
    "retail-small": {
      product: "1С:Управление торговлей (УТ)",
      description: "Полнофункциональное решение для торгового предприятия",
      features: ["Управление продажами", "Складской учет", "CRM", "Интеграция с интернет-магазином"],
      price: "от 35 000 ₽",
      implementation: "2-4 недели"
    },
    "wholesale-medium": {
      product: "1С:Комплексная автоматизация",
      description: "Комплексное решение для среднего и крупного бизнеса",
      features: ["Управление торговлей", "Производство", "Бухгалтерия", "Зарплата и кадры"],
      price: "от 75 000 ₽",
      implementation: "1-3 месяца"
    }
  };

  const handleGetRecommendation = () => {
    const key = `${selectedBusiness}-${selectedSize}`;
    const rec = recommendations[key] || recommendations["retail-small"];
    setRecommendation(rec);
  };

  return (
    <Layout>
      <div className="py-20 bg-gradient-to-br from-background via-secondary/50 to-accent/10">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h1 className="text-4xl lg:text-5xl font-bold text-foreground mb-6">
              Какая база 1С мне нужна?
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              Интерактивный помощник поможет выбрать оптимальную конфигурацию 1С 
              для вашего бизнеса
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-8">
            {/* Шаг 1: Тип бизнеса */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center space-x-3">
                  <Building2 className="w-8 h-8 text-primary" />
                  <span>Шаг 1: Выберите тип вашего бизнеса</span>
                </CardTitle>
                <CardDescription>
                  Это поможет нам подобрать наиболее подходящее решение
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {businessTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => setSelectedBusiness(type.id)}
                      className={`p-4 rounded-lg border transition-all text-left ${
                        selectedBusiness === type.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <type.icon className={`w-6 h-6 ${
                          selectedBusiness === type.id ? "text-primary" : "text-muted-foreground"
                        }`} />
                        <span className="font-medium">{type.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Шаг 2: Размер компании */}
            <Card className="border-border">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center space-x-3">
                  <Users className="w-8 h-8 text-primary" />
                  <span>Шаг 2: Укажите размер компании</span>
                </CardTitle>
                <CardDescription>
                  Количество сотрудников влияет на выбор конфигурации
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3">
                  {companySizes.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size.id)}
                      className={`p-4 rounded-lg border transition-all text-left ${
                        selectedSize === size.id
                          ? "border-primary bg-primary/5"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium">{size.label}</span>
                        <Badge variant="secondary">{size.employees}</Badge>
                      </div>
                    </button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Кнопка получения рекомендации */}
            {selectedBusiness && selectedSize && (
              <div className="text-center">
                <Button 
                  variant="hero" 
                  size="lg" 
                  onClick={handleGetRecommendation}
                  className="animate-fade-in"
                >
                  Получить рекомендацию
                  <ArrowRight className="w-5 h-5 ml-2" />
                </Button>
              </div>
            )}

            {/* Результат */}
            {recommendation && (
              <Card className="border-border bg-gradient-to-r from-primary/5 to-accent/5 animate-fade-in">
                <CardHeader>
                  <div className="flex items-center space-x-3">
                    <CheckCircle className="w-8 h-8 text-primary" />
                    <div>
                      <CardTitle className="text-2xl">Рекомендация для вас</CardTitle>
                      <CardDescription>
                        Оптимальное решение для вашего бизнеса
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    <div>
                      <h3 className="text-xl font-bold text-primary mb-2">
                        {recommendation.product}
                      </h3>
                      <p className="text-muted-foreground">
                        {recommendation.description}
                      </p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                      <div>
                        <h4 className="font-semibold text-foreground mb-3">Основные возможности:</h4>
                        <ul className="space-y-2">
                          {recommendation.features.map((feature, index) => (
                            <li key={index} className="flex items-center space-x-2">
                              <CheckCircle className="w-4 h-4 text-primary" />
                              <span className="text-muted-foreground">{feature}</span>
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="space-y-4">
                        <div className="p-4 bg-background rounded-lg border border-border">
                          <div className="text-sm text-muted-foreground">Стоимость внедрения</div>
                          <div className="text-2xl font-bold text-primary">{recommendation.price}</div>
                        </div>
                        <div className="p-4 bg-background rounded-lg border border-border">
                          <div className="text-sm text-muted-foreground">Срок внедрения</div>
                          <div className="text-xl font-semibold">{recommendation.implementation}</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col sm:flex-row gap-4 pt-4">
                      <Button variant="default" size="lg" asChild>
                        <Link to="/contacts">Заказать внедрение</Link>
                      </Button>
                        <Button variant="outline" size="lg" asChild>
                          <Link to="/contacts">Получить консультацию</Link>
                        </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Дополнительная информация */}
            <Card className="border-border">
              <CardContent className="p-6">
                <div className="flex items-start space-x-3">
                  <Info className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-foreground mb-2">
                      Нужна индивидуальная консультация?
                    </h3>
                    <p className="text-muted-foreground mb-4">
                      Наши эксперты проведут детальный анализ ваших бизнес-процессов 
                      и подберут оптимальное решение с учетом всех особенностей.
                    </p>
                    <Button variant="outline" asChild>
                      <Link to="/contacts">Связаться с экспертом</Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default DatabaseHelp;