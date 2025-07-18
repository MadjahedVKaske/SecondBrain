import Layout from "@/components/layout/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";

const Software = () => {
  const versions = [
    { name: "Стандарт", description: "Минимальный функционал", mode: "Офлайн-режим" },
    { name: "Стандарт Pro", description: "Расширенная версия", mode: "Офлайн-режим" },
    { name: "Online Lite", description: "Базовый онлайн", mode: "Онлайн-режим" },
    { name: "Online", description: "Расширенный функционал", mode: "Онлайн-режим" }
  ];

  const solutions = [
    "DM.Доставка Pro — решение для автоматизации курьеров в соответствии с требованиями 54-ФЗ",
    "DM.Invent — ПО для учета основных средств на предприятии, в том числе с использованием RFID-технологии",
    "DM.ТОИР — ПО для контроля состояния основных средств и работы сервисных служб",
    "DM.Прайсчекер — программа для стационарных информационных киосков"
  ];

  const tasks = [
    "идентификация товара",
    "приемка, отпуск и перемещение продукции",
    "инвентаризация",
    "сбор заказов",
    "адресное хранение",
    "проверка ценников, переоценка"
  ];

  const advantages = [
    "быстрая установка и простая интеграция с учетной системой",
    "удобный и понятный интерфейс",
    "параметрическая настройка бизнес-процессов (без программирования)",
    "несколько способов обмена данными в режимах офлайн и онлайн",
    "регулярные обновления",
    "возможность расширения функциональности с сохранением настроек базы",
    "быстрая и бесплатная техподдержка"
  ];

  return (
    <Layout>
      <div className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 text-foreground">
            Программное обеспечение DataMobile
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Специализированные программные продукты для автоматизации бизнеса
          </p>
        </div>

        {/* Main Description */}
        <Card className="mb-8">
          <CardContent className="p-8">
            <div className="prose max-w-none">
              <p className="text-lg leading-relaxed mb-6">
                Мы разрабатываем и внедряем мобильные бизнес-решения для автоматизации склада, 
                торговли, производства, логистики, учета маркированной и алкогольной продукции.
              </p>
              <blockquote className="border-l-4 border-primary pl-4 italic text-muted-foreground mb-6">
                В портфеле нашей компании решения для учета на базе штрихкодирования, 
                а также с использованием RFID-технологии.
              </blockquote>
              <p className="mb-4">
                Программное обеспечение DataMobile предназначено для терминалов сбора данных (ТСД) 
                и других мобильных устройств на Android.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Tasks Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>ПО решает ряд типовых и специализированных задач</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {tasks.map((task, index) => (
                <div key={index} className="flex items-center space-x-2">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>{task}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Advantages Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Основные преимущества ПО DataMobile</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {advantages.map((advantage, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{advantage}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Versions Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>DataMobile доступно в 4 версиях</CardTitle>
            <CardDescription>
              Программа масштабируется путем апгрейда с одной версии на последующую
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {versions.map((version, index) => (
                <Card key={index} className="border">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg">{version.name}</CardTitle>
                    <Badge variant="secondary">{version.mode}</Badge>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{version.description}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Modules Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>К DataMobile можно подключить модули</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">Маркировка</h3>
              <p className="text-muted-foreground">
                Решение для учета товаров, прослеживаемых через систему «Честный ЗНАК»
              </p>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="font-semibold mb-2">RFID</h3>
              <p className="text-muted-foreground">
                Для использования устройств с RFID-считывателем и учета по радиочастотным меткам
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Other Solutions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Другие решения в продуктовой линейке</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {solutions.map((solution, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                  <span>{solution}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* License Options */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Варианты приобретения лицензии</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Lifetime</h3>
                <p className="text-muted-foreground mb-4">
                  Бессрочное пользование — привязывается к одному устройству
                </p>
                <Badge variant="outline">Единоразовая покупка</Badge>
              </div>
              <div className="border rounded-lg p-6">
                <h3 className="font-semibold text-lg mb-3">Подписка DMcloud</h3>
                <p className="text-muted-foreground mb-4">
                  Облачный сервис на 1, 6 или 12 месяцев с личным кабинетом для управления лицензиями
                </p>
                <Badge variant="outline">Гибкое управление</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Integration */}
        <Card className="mb-8">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Интеграция с учетными системами</h2>
            <p className="text-lg text-muted-foreground mb-6">
              ПО DataMobile интегрируется с большинством товароучетных систем. 
              Для 1С существуют готовые интерфейсы обмена. Предприятия с другими системами 
              могут внедрить DataMobile благодаря открытым форматам обмена данными.
            </p>
            <div className="space-y-4">
              <p className="font-medium">
                Наша компания оказывает услуги по настройке и внедрению программного обеспечения, 
                а также доработки функционала под индивидуальные нужды заказчика.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* CTA Section */}
        <Card className="bg-gradient-to-r from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-4">Готовы автоматизировать свой бизнес?</h2>
            <p className="text-lg text-muted-foreground mb-6">
              Получите консультацию по выбору оптимального решения для вашей компании
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button size="lg">Запросить демонстрацию</Button>
              <Button variant="outline" size="lg">Получить коммерческое предложение</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Software;
