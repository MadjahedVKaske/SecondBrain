import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Users, TrendingUp, Shield, FileSearch, Calendar, MessageSquare, ClipboardCheck } from "lucide-react";
import { Link } from "react-router-dom";

const AntiCrisisAnalysis = () => {
  const features = [
    {
      icon: FileSearch,
      title: "Управление",
      description: "Анализ систем управления и процессов принятия решений"
    },
    {
      icon: Users,
      title: "Мотивация сотрудников",
      description: "Оценка системы мотивации и вовлеченности персонала"
    },
    {
      icon: TrendingUp,
      title: "Производительность",
      description: "Анализ эффективности работы сотрудников и процессов"
    },
    {
      icon: Shield,
      title: "Учёт финансов",
      description: "Проверка финансового учета и контроля денежных потоков"
    }
  ];

  const strategicPlan = [
    "Мотивации сотрудников",
    "Определения сфер для усиления и улучшения",
    "Масштабирования бизнеса",
    "Индивидуальные рекомендации"
  ];

  const workProcess = [
    {
      step: "1",
      title: "Оставьте заявку",
      description: "Заполните простую форму, после чего мы свяжемся с вами для назначения даты первого интервью.",
      icon: MessageSquare
    },
    {
      step: "2", 
      title: "Пройдите интервью",
      description: "Предоставьте материалы для анализа. Продолжительность — примерно 1,5–2 часа.",
      icon: Calendar
    },
    {
      step: "3",
      title: "Анализ документации",
      description: "На протяжении недели будем взаимодействовать с руководством и сотрудниками.",
      icon: FileSearch
    },
    {
      step: "4",
      title: "Получите готовый план",
      description: "Завершённый план поможет выйти из кризиса и повысить эффективность всего через неделю.",
      icon: ClipboardCheck
    }
  ];

  return (
    <Layout>
      {/* Hero Section */}
      <section className="bg-gradient-hero text-primary-foreground py-20">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Антикризисный анализ бизнес-процессов
            </h1>
            <p className="text-xl md:text-2xl mb-8 opacity-90">
              Запустите рекомендации наших экспертов по управлению бизнесом и увеличьте прибыль
            </p>
            <p className="text-lg mb-8 opacity-80 max-w-3xl mx-auto">
              Мы выявим слабые места в ваших бизнес-процессах и предложим эффективные решения.
            </p>
            <Button variant="secondary" size="xl" asChild>
              <Link to="/contacts">Получить анализ</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* What We Offer */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Что мы вам предлагаем
            </h2>

            {/* Detailed Anti-Crisis Plan */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-2xl">Подробный антикризисный план</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-6">
                  Пошаговые действия для выхода из кризиса с углубленным анализом ключевых систем:
                </p>
                <div className="grid md:grid-cols-2 gap-6">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-start space-x-4">
                      <feature.icon className="w-6 h-6 text-primary mt-1 flex-shrink-0" />
                      <div>
                        <h3 className="font-semibold mb-2">{feature.title}</h3>
                        <p className="text-muted-foreground">{feature.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-6 italic">
                  * Список разделов анализа может варьироваться в зависимости от вашей ситуации
                </p>
              </CardContent>
            </Card>

            {/* Strategic Plan */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-2xl">Стратегический план</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg mb-6">
                  Конкретные шаги для развития вашего бизнеса:
                </p>
                <div className="grid md:grid-cols-2 gap-4">
                  {strategicPlan.map((item, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Automated Solutions */}
            <Card className="mb-8">
              <CardHeader>
                <CardTitle className="text-2xl">Автоматизированные решения</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-lg">
                  Подбор автоматизированных решений, адаптированных под потребности вашего бизнеса.
                </p>
              </CardContent>
            </Card>

            {/* Confidentiality */}
            <Card className="bg-accent/50">
              <CardContent className="p-6">
                <div className="flex items-start space-x-4">
                  <Shield className="w-8 h-8 text-primary flex-shrink-0 mt-1" />
                  <div>
                    <h3 className="text-xl font-semibold mb-2">Конфиденциальность данных</h3>
                    <p className="text-muted-foreground">
                      Конфиденциальность ваших данных — наш главный приоритет. Мы гарантируем сохранение ваших данных и подписываем договор, защищающий вашу информацию.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How We Work */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-6xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-16">
              Как мы работаем
            </h2>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {workProcess.map((step, index) => (
                <Card key={index} className="text-center">
                  <CardContent className="p-6">
                    <div className="bg-gradient-primary text-primary-foreground w-12 h-12 rounded-full flex items-center justify-center text-xl font-bold mx-auto mb-4">
                      {step.step}
                    </div>
                    <step.icon className="w-8 h-8 text-primary mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-3">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-accent text-accent-foreground">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Готовы начать антикризисный анализ?
          </h2>
          <p className="text-xl mb-8 opacity-90 max-w-2xl mx-auto">
            Получите завершённый план всего через неделю и выведите свой бизнес на новый уровень эффективности
          </p>
          <Button variant="secondary" size="xl" asChild>
            <Link to="/contacts">Оставить заявку</Link>
          </Button>
        </div>
      </section>
    </Layout>
  );
};

export default AntiCrisisAnalysis;